package com.kaombodj.projectrebuild.companion

import org.json.JSONObject

data class HealthObservation(
    val metric: String,
    val value: Double,
    val unit: String,
    val recordedAt: String,
    val externalRecordId: String,
    val originName: String? = null,
    val deviceName: String? = null,
    val metadata: Map<String, Any?> = emptyMap(),
) {
    fun toJson(): JSONObject = JSONObject().apply {
        put("metric", metric)
        put("value", value)
        put("unit", unit)
        put("recordedAt", recordedAt)
        put("externalRecordId", externalRecordId)
        originName?.let { put("originName", it) }
        deviceName?.let { put("deviceName", it) }
        if (metadata.isNotEmpty()) put("metadata", JSONObject(metadata))
    }
}

