package com.kaombodj.projectrebuild.companion

import android.os.Build
import org.json.JSONArray
import org.json.JSONObject
import java.net.HttpURLConnection
import java.net.URI
import java.net.URL
import java.util.UUID

class RebuildApiClient(private val baseUrl: String = BuildConfig.REBUILD_API_BASE_URL) {
    init { require(isAllowedBaseUrl(baseUrl)) { "Untrusted API endpoint" } }

    data class PairingResult(val token: String, val deviceId: String, val expiresAt: String)

    fun exchangePairingCode(code: String, installationId: String): PairingResult {
        val body = JSONObject()
            .put("code", code.trim())
            .put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}".trim().take(120))
            .put("installationId", installationId)
        val result = post("/api/companion/pairing/exchange", body, null)
        return PairingResult(result.getString("token"), result.getString("deviceId"), result.getString("expiresAt"))
    }

    fun registerHealthSource(token: String, installationId: String): String {
        val metrics = JSONArray(ALLOWED_METRICS)
        val body = JSONObject()
            .put("sourceKey", "health-connect:$installationId")
            .put("provider", "health_connect")
            .put("label", "Health Connect — ${Build.MODEL}".take(120))
            .put("deviceName", "${Build.MANUFACTURER} ${Build.MODEL}".trim().take(120))
            .put("authorizedMetrics", metrics)
        return post("/api/companion/health/source", body, token).getString("sourceId")
    }

    fun importObservations(token: String, sourceId: String, observations: List<HealthObservation>): Int {
        if (observations.isEmpty()) return 0
        var imported = 0
        observations.chunked(500).forEach { chunk ->
            val body = JSONObject().put("sourceId", sourceId).put("observations", JSONArray(chunk.map { it.toJson() }))
            val result = post("/api/companion/health/observations", body, token)
            imported += result.optInt("imported", chunk.size)
        }
        return imported
    }

    fun disconnect(token: String) { post("/api/companion/disconnect", JSONObject(), token) }

    private fun post(path: String, body: JSONObject, token: String?): JSONObject {
        val target = URL(baseUrl.trimEnd('/') + path)
        val connection = target.openConnection() as HttpURLConnection
        return try {
            connection.requestMethod = "POST"
            connection.connectTimeout = 15_000
            connection.readTimeout = 30_000
            connection.doOutput = true
            connection.useCaches = false
            connection.instanceFollowRedirects = false
            connection.setRequestProperty("Content-Type", "application/json; charset=utf-8")
            connection.setRequestProperty("Accept", "application/json")
            token?.let { connection.setRequestProperty("Authorization", "Bearer $it") }
            connection.outputStream.use { it.write(body.toString().toByteArray(Charsets.UTF_8)) }
            val status = connection.responseCode
            val stream = if (status in 200..299) connection.inputStream else connection.errorStream
            val response = stream?.bufferedReader(Charsets.UTF_8)?.use { it.readText() }.orEmpty()
            if (status !in 200..299) throw ApiException(status, safeError(response))
            if (response.isBlank()) JSONObject() else JSONObject(response)
        } finally {
            connection.disconnect()
        }
    }

    private fun safeError(response: String): String = runCatching {
        JSONObject(response).optString("error").take(80).ifBlank { "request-failed" }
    }.getOrDefault("request-failed")

    class ApiException(val status: Int, val safeCode: String) : Exception("API request failed: $status/$safeCode")

    companion object {
        val ALLOWED_METRICS = listOf(
            "height_cm", "weight_kg", "body_fat_percent", "steps_count", "sleep_minutes",
            "resting_heart_rate_bpm", "hrv_ms", "workout_minutes", "spo2_percent",
        )

        fun isAllowedBaseUrl(value: String): Boolean = runCatching {
            val uri = URI(value)
            uri.scheme == "https" && uri.host == "project-rebuild-chi.vercel.app" &&
                uri.port == -1 && uri.userInfo == null && uri.query == null && uri.fragment == null
        }.getOrDefault(false)

        fun installationId(context: android.content.Context): String {
            val preferences = context.getSharedPreferences("rebuild_companion_installation", android.content.Context.MODE_PRIVATE)
            return preferences.getString("id", null) ?: UUID.randomUUID().toString().also {
                preferences.edit().putString("id", it).apply()
            }
        }
    }
}

