package com.olog.forestrelay;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@SpringBootApplication
@ConfigurationPropertiesScan
public class ForestRelayApplication {

    public static void main(String[] args) {
        SpringApplication.run(ForestRelayApplication.class, args);
    }
}
