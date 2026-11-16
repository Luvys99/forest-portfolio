package com.olog.forestrelay.relay;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/**
 * 방별 플레이어 목록. 방 이름 → (세션 id → PlayerState).
 * 정원 검사와 추가를 한 번에 해야 두 사람이 동시에 마지막 자리에 들어오는 일이 없으므로 방 단위로 잠근다.
 */
@Component
public class RoomRegistry {

    private final Map<String, Map<String, PlayerState>> rooms = new ConcurrentHashMap<>();

    private Map<String, PlayerState> room(String name) {
        return rooms.computeIfAbsent(name, k -> new ConcurrentHashMap<>());
    }

    /** 정원이 차 있으면 false 를 돌려주고 넣지 않는다. */
    public boolean tryAdd(String roomName, PlayerState player, int capacity) {
        Map<String, PlayerState> room = room(roomName);
        synchronized (room) {
            if (room.size() >= capacity) {
                return false;
            }
            room.put(player.id(), player);
            return true;
        }
    }

    public void remove(String roomName, PlayerState player) {
        if (roomName == null) {
            return;
        }
        Map<String, PlayerState> room = rooms.get(roomName);
        if (room != null) {
            room.remove(player.id());
        }
    }

    /** 같은 방 사람들 (본인 제외). 순회 중 변경되어도 안전하도록 복사본을 준다. */
    public List<PlayerState> others(String roomName, String selfId) {
        Map<String, PlayerState> room = rooms.get(roomName);
        if (room == null) {
            return List.of();
        }
        List<PlayerState> result = new ArrayList<>(room.size());
        for (PlayerState p : room.values()) {
            if (!p.id().equals(selfId)) {
                result.add(p);
            }
        }
        return result;
    }

    public int size(String roomName) {
        Map<String, PlayerState> room = rooms.get(roomName);
        return room == null ? 0 : room.size();
    }
}
