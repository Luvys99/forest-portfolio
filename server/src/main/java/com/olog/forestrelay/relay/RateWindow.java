package com.olog.forestrelay.relay;

/**
 * 1초 창 안에서 몇 번까지 받을지. 세션 하나의 메시지 종류 하나(move, chat)마다 하나씩 둔다.
 * 넘친 메시지는 버린다. 여러 스레드에서 부를 수 있으므로 synchronized.
 */
final class RateWindow {

    private final int limitPerSecond;
    private long windowStartMillis;
    private int countInWindow;

    RateWindow(int limitPerSecond) {
        this.limitPerSecond = limitPerSecond;
    }

    synchronized boolean allow(long nowMillis) {
        if (nowMillis - windowStartMillis >= 1000) {
            windowStartMillis = nowMillis;
            countInWindow = 0;
        }
        countInWindow++;
        return countInWindow <= limitPerSecond;
    }
}
