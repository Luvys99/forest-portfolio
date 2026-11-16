package com.olog.forestrelay.config;

import java.util.List;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * application.yml 의 relay.* 설정.
 * 서버가 "검사"하는 값은 전부 여기에 모아 두어, 맵이 바뀌어도 코드가 아니라 설정만 고치면 된다.
 */
@ConfigurationProperties(prefix = "relay")
public record RelayProperties(
        List<String> allowedOrigins,
        int roomCapacity,
        int moveRatePerSecond,
        Bounds bounds
) {

    public record Bounds(double minX, double maxX, double minY, double maxY) {

        public boolean contains(double x, double y) {
            return x >= minX && x <= maxX && y >= minY && y <= maxY;
        }
    }
}
