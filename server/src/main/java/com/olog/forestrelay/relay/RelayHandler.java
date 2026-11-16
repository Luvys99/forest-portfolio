package com.olog.forestrelay.relay;

import com.olog.forestrelay.config.RelayProperties;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.ConcurrentWebSocketSessionDecorator;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 중계의 전부. 받은 메시지를 검사해서 같은 방 사람들에게 그대로 전달한다.
 *
 * 클라이언트 → 서버: join, move, room
 * 서버 → 클라이언트: welcome, joined, moved, left, error  ({@link Messages})
 *
 * 서버는 물리·충돌·기록을 판정하지 않는다. 그래서 틱 루프가 없고, 메시지가 올 때만 일한다.
 */
@Component
public class RelayHandler extends TextWebSocketHandler {

    private static final Logger log = LoggerFactory.getLogger(RelayHandler.class);

    // 한 세션에 보내는 메시지가 밀릴 때: 2초 넘게 못 보내거나 버퍼가 64KB 를 넘으면 그 세션을 끊는다
    private static final int SEND_TIME_LIMIT_MS = 2_000;
    private static final int SEND_BUFFER_LIMIT_BYTES = 64 * 1024;

    private final RoomRegistry rooms;
    private final RelayProperties properties;
    private final ObjectMapper json;

    // 세션 id → 상태. join 전의 세션도 들어 있다 (room == null)
    private final Map<String, PlayerState> players = new ConcurrentHashMap<>();

    public RelayHandler(RoomRegistry rooms, RelayProperties properties, ObjectMapper json) {
        this.rooms = rooms;
        this.properties = properties;
        this.json = json;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) {
        // 같은 세션에 여러 스레드가 동시에 send 하면 안 되므로 (다른 사람들의 move 가 각자 스레드에서 들어온다) 직렬화해 주는 래퍼로 감싼다
        WebSocketSession safe = new ConcurrentWebSocketSessionDecorator(session, SEND_TIME_LIMIT_MS, SEND_BUFFER_LIMIT_BYTES);
        String id = UUID.randomUUID().toString();
        players.put(session.getId(), new PlayerState(id, safe));
        log.debug("connected {} (session {})", id, session.getId());
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) {
        PlayerState player = players.get(session.getId());
        if (player == null) {
            return;
        }

        JsonNode node;
        try {
            node = json.readTree(message.getPayload());
        } catch (JacksonException e) {
            log.debug("ignoring non-JSON message from {}", player.id());
            return;
        }

        String type = node.path("type").asString(null);
        if (type == null) {
            return;
        }
        switch (type) {
            case "join" -> onJoin(player, node);
            case "move" -> onMove(player, node);
            case "room" -> onRoom(player, node);
            default -> log.debug("ignoring unknown type '{}' from {}", type, player.id());
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) {
        PlayerState player = players.remove(session.getId());
        if (player == null) {
            return;
        }
        String room = player.room();
        if (room != null) {
            rooms.remove(room, player);
            broadcast(room, player.id(), Messages.Left.of(player.id()));
        }
        log.debug("disconnected {} ({})", player.id(), status);
    }

    @Override
    public void handleTransportError(WebSocketSession session, Throwable exception) {
        log.debug("transport error on {}: {}", session.getId(), exception.toString());
        close(session, CloseStatus.SERVER_ERROR);
    }

    // ---- 메시지별 처리 ----

    private void onJoin(PlayerState player, JsonNode node) {
        if (player.isJoined()) {
            return; // 이미 들어와 있으면 무시
        }
        String name = Validation.name(node.get("name"));
        String color = Validation.color(node.get("color"));
        String room = Validation.room(node.get("room"));
        if (name == null || color == null || room == null) {
            send(player, Messages.Error.of("invalid_join"));
            return;
        }

        player.join(name, color, room);
        if (!rooms.tryAdd(room, player, properties.roomCapacity())) {
            player.moveTo(null, 0, 0);
            send(player, Messages.Error.of("room_full"));
            close(player.session(), CloseStatus.POLICY_VIOLATION);
            return;
        }

        sendWelcome(player, room);
        broadcast(room, player.id(), Messages.Joined.of(player.snapshot()));
        log.info("{} joined {} as '{}' ({} in room)", player.id(), room, name, rooms.size(room));
    }

    private void onMove(PlayerState player, JsonNode node) {
        String room = player.room();
        if (room == null) {
            return; // join 전
        }
        if (!player.allowMove(System.currentTimeMillis(), properties.moveRatePerSecond())) {
            return; // 너무 잦은 전송은 조용히 버린다
        }
        JsonNode xNode = node.get("x");
        JsonNode yNode = node.get("y");
        Integer facing = Validation.facing(node.get("facing"));
        String state = Validation.state(node.get("state"));
        if (!Validation.isFiniteNumber(xNode) || !Validation.isFiniteNumber(yNode) || facing == null || state == null) {
            return;
        }
        double x = xNode.asDouble();
        double y = yNode.asDouble();
        if (!properties.bounds().contains(x, y)) {
            return;
        }

        player.update(x, y, facing, state);
        broadcast(room, player.id(), Messages.Moved.of(player.snapshot()));
    }

    /** 다른 방으로 이동. 이전 방에는 left, 새 방에는 joined, 본인에게는 새 방 사람들이 담긴 welcome. */
    private void onRoom(PlayerState player, JsonNode node) {
        String from = player.room();
        if (from == null) {
            return;
        }
        String to = Validation.room(node.get("room"));
        JsonNode xNode = node.get("x");
        JsonNode yNode = node.get("y");
        if (to == null || !Validation.isFiniteNumber(xNode) || !Validation.isFiniteNumber(yNode)) {
            send(player, Messages.Error.of("invalid_room"));
            return;
        }
        double x = xNode.asDouble();
        double y = yNode.asDouble();
        if (!properties.bounds().contains(x, y)) {
            send(player, Messages.Error.of("invalid_room"));
            return;
        }
        if (to.equals(from)) {
            return;
        }

        rooms.remove(from, player);
        broadcast(from, player.id(), Messages.Left.of(player.id()));

        player.moveTo(to, x, y);
        if (!rooms.tryAdd(to, player, properties.roomCapacity())) {
            // 새 방이 꽉 찼으면 이전 방으로 되돌린다
            player.moveTo(from, x, y);
            rooms.tryAdd(from, player, Integer.MAX_VALUE);
            send(player, Messages.Error.of("room_full"));
            sendWelcome(player, from);
            broadcast(from, player.id(), Messages.Joined.of(player.snapshot()));
            return;
        }

        sendWelcome(player, to);
        broadcast(to, player.id(), Messages.Joined.of(player.snapshot()));
        log.info("{} moved {} -> {}", player.id(), from, to);
    }

    // ---- 전송 ----

    private void sendWelcome(PlayerState player, String room) {
        List<Messages.PlayerInfo> others = rooms.others(room, player.id()).stream()
                .map(PlayerState::snapshot)
                .toList();
        send(player, Messages.Welcome.of(player.id(), room, others));
    }

    private void broadcast(String room, String senderId, Object message) {
        String payload = json.writeValueAsString(message);
        for (PlayerState other : rooms.others(room, senderId)) {
            sendRaw(other, payload);
        }
    }

    private void send(PlayerState player, Object message) {
        sendRaw(player, json.writeValueAsString(message));
    }

    private void sendRaw(PlayerState player, String payload) {
        WebSocketSession session = player.session();
        if (!session.isOpen()) {
            return;
        }
        try {
            session.sendMessage(new TextMessage(payload));
        } catch (IOException | IllegalStateException e) {
            // 보내다 실패한 세션은 끊는다. afterConnectionClosed 가 뒤처리를 한다
            log.debug("send failed to {}: {}", player.id(), e.toString());
            close(session, CloseStatus.SESSION_NOT_RELIABLE);
        }
    }

    private void close(WebSocketSession session, CloseStatus status) {
        try {
            if (session.isOpen()) {
                session.close(status);
            }
        } catch (IOException ignored) {
            // 이미 닫힌 세션
        }
    }
}
