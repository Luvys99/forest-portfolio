package com.olog.forestrelay.relay;

import java.util.Set;

/** 방 이름. 클라이언트의 Phaser 씬 하나가 방 하나다. */
public final class Rooms {

    public static final String FOREST = "forest";
    public static final String SKY = "sky";

    private static final Set<String> ALL = Set.of(FOREST, SKY);

    private Rooms() {
    }

    public static boolean isValid(String room) {
        return room != null && ALL.contains(room);
    }
}
