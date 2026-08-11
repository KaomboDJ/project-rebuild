package com.kaombodj.projectrebuild.companion

import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class RebuildApiClientTest {
    @Test fun acceptsOnlyTheProductionHttpsOrigin() {
        assertTrue(RebuildApiClient.isAllowedBaseUrl("https://project-rebuild-chi.vercel.app"))
        assertFalse(RebuildApiClient.isAllowedBaseUrl("http://project-rebuild-chi.vercel.app"))
        assertFalse(RebuildApiClient.isAllowedBaseUrl("https://project-rebuild-chi.vercel.app.evil.test"))
        assertFalse(RebuildApiClient.isAllowedBaseUrl("https://user@project-rebuild-chi.vercel.app"))
        assertFalse(RebuildApiClient.isAllowedBaseUrl("https://project-rebuild-chi.vercel.app?token=x"))
    }
}
