package com.olog.forestrelay.relay;

import java.util.List;

/**
 * 서버 → 클라이언트 메시지. 전부 {"type": "..."} 로 시작하는 JSON 이다.
 * 규약 전체는 server/README.md 와 이슈 #34 에 있다.
 */
public final class Messages {

    private Messages() {
    }

    public record PlayerInfo(String id, String name, String color, double x, double y, int facing, String state) {
    }

    /** join 또는 room 처리 결과로 본인에게. 같은 방에 이미 있는 사람들 목록을 담는다. */
    public record Welcome(String type, String id, String room, List<PlayerInfo> players) {
        public static Welcome of(String id, String room, List<PlayerInfo> players) {
            return new Welcome("welcome", id, room, players);
        }
    }

    /** 같은 방의 다른 사람들에게: 누가 들어왔다. */
    public record Joined(String type, PlayerInfo player) {
        public static Joined of(PlayerInfo player) {
            return new Joined("joined", player);
        }
    }

    /** 같은 방의 다른 사람들에게: 누가 움직였다. */
    public record Moved(String type, String id, double x, double y, int facing, String state) {
        public static Moved of(PlayerInfo p) {
            return new Moved("moved", p.id(), p.x(), p.y(), p.facing(), p.state());
        }
    }

    /** 같은 방의 다른 사람들에게: 누가 나갔다 (접속 종료 또는 다른 방으로 이동). */
    public record Left(String type, String id) {
        public static Left of(String id) {
            return new Left("left", id);
        }
    }

    /** 본인에게: 요청을 거절했다. reason 은 invalid_join, room_full 등. */
    public record Error(String type, String reason) {
        public static Error of(String reason) {
            return new Error("error", reason);
        }
    }
}
