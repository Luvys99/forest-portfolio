package com.olog.forestrelay.relay;

import org.springframework.web.socket.WebSocketSession;

/**
 * 접속한 세션 하나의 상태. 서버가 기억하는 건 이게 전부다 (이름, 색, 방, 마지막 좌표).
 * 물리나 맵은 모른다. 좌표는 클라이언트가 보낸 값을 그대로 보관했다가 새로 들어온 사람에게 알려 주는 용도다.
 *
 * 여러 스레드(각 세션의 수신 스레드)에서 읽고 쓰므로 변경은 synchronized 로 감싼다.
 */
public final class PlayerState {

    private final String id;
    private final WebSocketSession session;

    private String name;
    private String color;
    private String room;
    private double x;
    private double y;
    private int facing = 1;
    private String state = "idle";

    // move 빈도 제한: 1초 창 안에서 몇 번 받았는지 센다
    private long windowStartMillis;
    private int movesInWindow;

    PlayerState(String id, WebSocketSession session) {
        this.id = id;
        this.session = session;
    }

    public String id() {
        return id;
    }

    WebSocketSession session() {
        return session;
    }

    public synchronized boolean isJoined() {
        return room != null;
    }

    public synchronized String room() {
        return room;
    }

    synchronized void join(String name, String color, String room) {
        this.name = name;
        this.color = color;
        this.room = room;
    }

    synchronized void moveTo(String room, double x, double y) {
        this.room = room;
        this.x = x;
        this.y = y;
        this.facing = 1;
        this.state = "idle";
    }

    synchronized void update(double x, double y, int facing, String state) {
        this.x = x;
        this.y = y;
        this.facing = facing;
        this.state = state;
    }

    /** 1초 창 안의 move 횟수가 limit 를 넘으면 false. 넘친 메시지는 버린다. */
    synchronized boolean allowMove(long nowMillis, int limit) {
        if (nowMillis - windowStartMillis >= 1000) {
            windowStartMillis = nowMillis;
            movesInWindow = 0;
        }
        movesInWindow++;
        return movesInWindow <= limit;
    }

    public synchronized Messages.PlayerInfo snapshot() {
        return new Messages.PlayerInfo(id, name, color, x, y, facing, state);
    }
}
