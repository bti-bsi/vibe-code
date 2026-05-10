package com.alibaba.vibe.code.cli.transport;

import com.alibaba.vibe.code.cli.protocol.data.PermissionMode;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class PermissionModeTest {

    @Test
    public void shouldBeReturnVibePermissionModeValue() {
        assertEquals("default", PermissionMode.DEFAULT.getValue());
        assertEquals("plan", PermissionMode.PLAN.getValue());
        assertEquals("auto-edit", PermissionMode.AUTO_EDIT.getValue());
        assertEquals("yolo", PermissionMode.YOLO.getValue());
    }

}
