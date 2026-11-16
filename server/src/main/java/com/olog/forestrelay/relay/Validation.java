package com.olog.forestrelay.relay;

import java.util.Set;
import java.util.regex.Pattern;
import tools.jackson.databind.JsonNode;

/**
 * 클라이언트가 보낸 값 검사. 규칙은 포트폴리오 클라이언트와 같아야 한다 (이름 1~12자 등).
 * 서버는 맵을 모르므로 좌표는 "숫자이고 범위 안"까지만 본다.
 */
final class Validation {

    static final int NAME_MAX = 12;
    private static final Pattern COLOR = Pattern.compile("^[0-9a-fA-F]{6}$");
    private static final Set<String> STATES = Set.of("idle", "walk", "jump", "climb");

    private Validation() {
    }

    /** 앞뒤 공백 제거, 제어 문자 제거. 비어 있거나 길면 null. */
    static String name(JsonNode node) {
        if (node == null || !node.isString()) {
            return null;
        }
        String cleaned = node.asString().replaceAll("[\\p{Cntrl}]", "").strip();
        if (cleaned.isEmpty() || cleaned.length() > NAME_MAX) {
            return null;
        }
        return cleaned;
    }

    /** "9dffd8" 처럼 hex 6자리. 소문자로 통일. */
    static String color(JsonNode node) {
        if (node == null || !node.isString()) {
            return null;
        }
        String value = node.asString().strip();
        return COLOR.matcher(value).matches() ? value.toLowerCase() : null;
    }

    static String room(JsonNode node) {
        if (node == null || !node.isString()) {
            return null;
        }
        String value = node.asString();
        return Rooms.isValid(value) ? value : null;
    }

    static boolean isFiniteNumber(JsonNode node) {
        return node != null && node.isNumber() && Double.isFinite(node.asDouble());
    }

    static Integer facing(JsonNode node) {
        if (node == null || !node.isNumber()) {
            return null;
        }
        int value = node.asInt();
        return (value == 1 || value == -1) ? value : null;
    }

    static String state(JsonNode node) {
        if (node == null || !node.isString()) {
            return null;
        }
        String value = node.asString();
        return STATES.contains(value) ? value : null;
    }
}
