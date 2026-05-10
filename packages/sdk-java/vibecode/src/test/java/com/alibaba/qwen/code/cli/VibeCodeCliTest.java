package com.alibaba.vibe.code.cli;

import java.util.List;

import com.alibaba.vibe.code.cli.transport.TransportOptions;

import org.junit.jupiter.api.Test;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import static org.junit.jupiter.api.Assertions.*;

class VibeCodeCliTest {

    private static final Logger log = LoggerFactory.getLogger(VibeCodeCliTest.class);
    @Test
    void simpleQuery() {
        List<String> result = VibeCodeCli.simpleQuery("hello world");
        log.info("simpleQuery result: {}", result);
        assertNotNull(result);
    }

    @Test
    void simpleQueryWithModel() {
        List<String> result = VibeCodeCli.simpleQuery("hello world", new TransportOptions().setModel("vibe-plus"));
        log.info("simpleQueryWithModel result: {}", result);
        assertNotNull(result);
    }
}
