package com.olog.forestrelay.relay;

import static org.assertj.core.api.Assertions.assertThat;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

class RateWindowTest {

    @Test
    @DisplayName("1초 안에는 정한 횟수까지만 받고, 1초가 지나면 다시 센다")
    void allowsUpToLimitPerSecond() {
        RateWindow window = new RateWindow(2);
        long t = 10_000;
        assertThat(window.allow(t)).isTrue();
        assertThat(window.allow(t + 100)).isTrue();
        assertThat(window.allow(t + 900)).isFalse();
        assertThat(window.allow(t + 1000)).isTrue();
        assertThat(window.allow(t + 1001)).isTrue();
        assertThat(window.allow(t + 1002)).isFalse();
    }
}
