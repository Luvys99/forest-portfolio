package com.olog.forestrelay.relay;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.concurrent.BlockingQueue;
import java.util.concurrent.LinkedBlockingQueue;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.server.LocalServerPort;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.client.standard.StandardWebSocketClient;
import org.springframework.web.socket.handler.TextWebSocketHandler;
import tools.jackson.databind.JsonNode;
import tools.jackson.databind.ObjectMapper;

/**
 * 브라우저 두 개가 붙은 상황을 흉내 낸다: A 가 먼저 들어오고 B 가 들어와 움직이고 나간다.
 */
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class RelayHandlerTest {

    @LocalServerPort
    int port;

    @Autowired
    ObjectMapper json;

    /** 받은 메시지를 큐에 쌓아 두는 테스트용 클라이언트. */
    class Client extends TextWebSocketHandler {

        final BlockingQueue<JsonNode> inbox = new LinkedBlockingQueue<>();
        WebSocketSession session;

        Client connect() throws Exception {
            session = new StandardWebSocketClient()
                    .execute(this, "ws://localhost:" + port + "/ws")
                    .get(5, TimeUnit.SECONDS);
            return this;
        }

        @Override
        protected void handleTextMessage(WebSocketSession session, TextMessage message) {
            inbox.add(json.readTree(message.getPayload()));
        }

        void send(String payload) throws Exception {
            session.sendMessage(new TextMessage(payload));
        }

        JsonNode next() throws Exception {
            JsonNode node = inbox.poll(3, TimeUnit.SECONDS);
            assertThat(node).as("메시지를 3초 안에 받아야 한다").isNotNull();
            return node;
        }

        void assertSilent() throws Exception {
            assertThat(inbox.poll(300, TimeUnit.MILLISECONDS)).as("메시지가 오면 안 된다").isNull();
        }
    }

    @Test
    void joinMoveLeaveAreRelayedWithinRoom() throws Exception {
        Client a = new Client().connect();
        a.send("""
                {"type":"join","name":" 숲지기 ","color":"9DFFD8","room":"forest"}""");
        JsonNode welcomeA = a.next();
        assertThat(welcomeA.path("type").asString()).isEqualTo("welcome");
        assertThat(welcomeA.path("players")).isEmpty();
        String idA = welcomeA.path("id").asString();

        Client b = new Client().connect();
        b.send("""
                {"type":"join","name":"방문자","color":"ffaa00","room":"forest"}""");
        JsonNode welcomeB = b.next();
        assertThat(welcomeB.path("players")).hasSize(1);
        assertThat(welcomeB.path("players").get(0).path("name").asString()).isEqualTo("숲지기"); // 공백 정리됨
        assertThat(welcomeB.path("players").get(0).path("color").asString()).isEqualTo("9dffd8"); // 소문자 통일
        String idB = welcomeB.path("id").asString();

        JsonNode joined = a.next();
        assertThat(joined.path("type").asString()).isEqualTo("joined");
        assertThat(joined.path("player").path("id").asString()).isEqualTo(idB);

        b.send("""
                {"type":"move","x":120.5,"y":640,"facing":-1,"state":"walk"}""");
        JsonNode moved = a.next();
        assertThat(moved.path("type").asString()).isEqualTo("moved");
        assertThat(moved.path("id").asString()).isEqualTo(idB);
        assertThat(moved.path("x").asDouble()).isEqualTo(120.5);
        assertThat(moved.path("facing").asInt()).isEqualTo(-1);
        b.assertSilent(); // 보낸 사람에게는 되돌아오지 않는다

        b.session.close();
        JsonNode left = a.next();
        assertThat(left.path("type").asString()).isEqualTo("left");
        assertThat(left.path("id").asString()).isEqualTo(idB);
        assertThat(idA).isNotEqualTo(idB);

        a.session.close();
    }

    @Test
    void roomChangeMovesPlayerBetweenRooms() throws Exception {
        Client forest = new Client().connect();
        forest.send("""
                {"type":"join","name":"숲","color":"9dffd8","room":"forest"}""");
        forest.next();

        Client sky = new Client().connect();
        sky.send("""
                {"type":"join","name":"하늘","color":"9dffd8","room":"sky"}""");
        sky.next();
        forest.assertSilent(); // 다른 방 입장은 보이지 않는다

        Client mover = new Client().connect();
        mover.send("""
                {"type":"join","name":"이동","color":"9dffd8","room":"forest"}""");
        String moverId = mover.next().path("id").asString();
        assertThat(forest.next().path("type").asString()).isEqualTo("joined");

        mover.send("""
                {"type":"room","room":"sky","x":100,"y":200}""");
        JsonNode welcome = mover.next();
        assertThat(welcome.path("type").asString()).isEqualTo("welcome");
        assertThat(welcome.path("room").asString()).isEqualTo("sky");
        assertThat(welcome.path("players")).hasSize(1);

        JsonNode left = forest.next();
        assertThat(left.path("type").asString()).isEqualTo("left");
        assertThat(left.path("id").asString()).isEqualTo(moverId);

        JsonNode joined = sky.next();
        assertThat(joined.path("type").asString()).isEqualTo("joined");
        assertThat(joined.path("player").path("id").asString()).isEqualTo(moverId);
        assertThat(joined.path("player").path("x").asDouble()).isEqualTo(100);

        forest.session.close();
        sky.session.close();
        mover.session.close();
    }

    @Test
    void invalidMessagesAreRejectedOrIgnored() throws Exception {
        Client a = new Client().connect();
        a.send("""
                {"type":"join","name":"이름이열두글자를넘어가는사람","color":"9dffd8","room":"forest"}""");
        JsonNode error = a.next();
        assertThat(error.path("type").asString()).isEqualTo("error");
        assertThat(error.path("reason").asString()).isEqualTo("invalid_join");

        a.send("""
                {"type":"join","name":"정상","color":"9dffd8","room":"forest"}""");
        a.next();

        Client b = new Client().connect();
        b.send("""
                {"type":"join","name":"관찰자","color":"9dffd8","room":"forest"}""");
        b.next();
        a.next(); // joined

        a.send("not json at all");
        a.send("""
                {"type":"move","x":999999,"y":0,"facing":1,"state":"walk"}""");   // 범위 밖
        a.send("""
                {"type":"move","x":10,"y":10,"facing":0,"state":"walk"}""");       // facing 잘못됨
        a.send("""
                {"type":"move","x":10,"y":10,"facing":1,"state":"fly"}""");        // 없는 상태
        a.send("""
                {"type":"attack","target":"b"}""");                                 // 모르는 타입
        b.assertSilent();

        a.session.close();
        b.session.close();
    }
}
