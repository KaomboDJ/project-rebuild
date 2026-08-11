package com.kaombodj.projectrebuild.companion

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

class SyncCoordinator(private val context: Context) {
    suspend fun sync(): Int = withContext(Dispatchers.IO) {
        require(HealthConnectReader.sdkAvailable(context)) { "health-connect-unavailable" }
        val vault = SecureTokenVault(context)
        val token = vault.token() ?: error("device-not-paired")
        val reader = HealthConnectReader(context)
        require(reader.hasRequiredPermissions()) { "health-permission-required" }
        val api = RebuildApiClient()
        val sourceId = vault.sourceId() ?: api.registerHealthSource(
            token,
            RebuildApiClient.installationId(context),
        ).also(vault::saveSourceId)
        api.importObservations(token, sourceId, reader.read())
    }
}

