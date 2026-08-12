package com.kaombodj.projectrebuild.companion

import android.content.Context
import android.os.Build
import androidx.health.connect.client.HealthConnectClient
import androidx.health.connect.client.permission.HealthPermission
import androidx.health.connect.client.records.BodyFatRecord
import androidx.health.connect.client.records.ExerciseSessionRecord
import androidx.health.connect.client.records.HeightRecord
import androidx.health.connect.client.records.HeartRateVariabilityRmssdRecord
import androidx.health.connect.client.records.OxygenSaturationRecord
import androidx.health.connect.client.records.Record
import androidx.health.connect.client.records.RestingHeartRateRecord
import androidx.health.connect.client.records.SleepSessionRecord
import androidx.health.connect.client.records.StepsRecord
import androidx.health.connect.client.records.WeightRecord
import androidx.health.connect.client.request.ReadRecordsRequest
import androidx.health.connect.client.time.TimeRangeFilter
import java.time.Duration
import java.time.Instant
import kotlin.reflect.KClass

class HealthConnectReader(context: Context) {
    private val client = HealthConnectClient.getOrCreate(context)
    private val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}".trim().take(120)

    val requiredPermissions: Set<String> = RECORD_TYPES.map { HealthPermission.getReadPermission(it) }.toSet()
    val backgroundPermission = "android.permission.health.READ_HEALTH_DATA_IN_BACKGROUND"

    suspend fun hasRequiredPermissions(): Boolean = client.permissionController
        .getGrantedPermissions().containsAll(requiredPermissions)

    suspend fun read(days: Long = 30): List<HealthObservation> {
        val end = Instant.now()
        val start = end.minus(Duration.ofDays(days.coerceIn(1, 30)))
        return buildList {
            readAll(WeightRecord::class, start, end).forEach { add(instant(it, "weight_kg", it.weight.inKilograms, "kg")) }
            readAll(HeightRecord::class, start, end).forEach { add(instant(it, "height_cm", it.height.inMeters * 100.0, "cm")) }
            readAll(BodyFatRecord::class, start, end).forEach { add(instant(it, "body_fat_percent", it.percentage.value, "%")) }
            readAll(StepsRecord::class, start, end).forEach { add(interval(it, "steps_count", it.count.toDouble(), "count")) }
            readAll(SleepSessionRecord::class, start, end).forEach {
                add(interval(it, "sleep_minutes", minutes(it.startTime, it.endTime), "min"))
            }
            readAll(RestingHeartRateRecord::class, start, end).forEach {
                add(instant(it, "resting_heart_rate_bpm", it.beatsPerMinute.toDouble(), "bpm"))
            }
            readAll(HeartRateVariabilityRmssdRecord::class, start, end).forEach {
                add(instant(it, "hrv_ms", it.heartRateVariabilityMillis, "ms"))
            }
            readAll(ExerciseSessionRecord::class, start, end).forEach {
                add(interval(it, "workout_minutes", minutes(it.startTime, it.endTime), "min"))
            }
            readAll(OxygenSaturationRecord::class, start, end).forEach {
                add(instant(it, "spo2_percent", it.percentage.value, "%"))
            }
        }.filter { it.value.isFinite() && it.value >= 0 }.distinctBy { it.externalRecordId }
    }

    private suspend fun <T : Record> readAll(type: KClass<T>, start: Instant, end: Instant): List<T> {
        val records = mutableListOf<T>()
        var pageToken: String? = null
        do {
            val response = client.readRecords(
                ReadRecordsRequest(
                    recordType = type,
                    timeRangeFilter = TimeRangeFilter.between(start, end),
                    pageSize = 500,
                    pageToken = pageToken,
                ),
            )
            records += response.records
            pageToken = response.pageToken
        } while (pageToken != null)
        return records
    }

    private fun instant(record: Record, metric: String, value: Double, unit: String): HealthObservation {
        val time = when (record) {
            is WeightRecord -> record.time
            is HeightRecord -> record.time
            is BodyFatRecord -> record.time
            is RestingHeartRateRecord -> record.time
            is HeartRateVariabilityRmssdRecord -> record.time
            is OxygenSaturationRecord -> record.time
            else -> Instant.now()
        }
        return observation(record, metric, value, unit, time)
    }

    private fun interval(record: Record, metric: String, value: Double, unit: String): HealthObservation {
        val (start, end) = when (record) {
            is StepsRecord -> record.startTime to record.endTime
            is SleepSessionRecord -> record.startTime to record.endTime
            is ExerciseSessionRecord -> record.startTime to record.endTime
            else -> Instant.now() to Instant.now()
        }
        return observation(record, metric, value, unit, end, mapOf("startTime" to start.toString()))
    }

    private fun observation(
        record: Record,
        metric: String,
        value: Double,
        unit: String,
        recordedAt: Instant,
        extraMetadata: Map<String, Any?> = emptyMap(),
    ) = HealthObservation(
        metric = metric,
        value = value,
        unit = unit,
        recordedAt = recordedAt.toString(),
        externalRecordId = "hc:${record::class.simpleName}:${record.metadata.id}".take(300),
        originName = record.metadata.dataOrigin.packageName.take(120),
        deviceName = deviceName,
        metadata = extraMetadata,
    )

    private fun minutes(start: Instant, end: Instant): Double = Duration.between(start, end).toMinutes().toDouble()

    companion object {
        val RECORD_TYPES: Set<KClass<out Record>> = setOf(
            WeightRecord::class,
            HeightRecord::class,
            BodyFatRecord::class,
            StepsRecord::class,
            SleepSessionRecord::class,
            RestingHeartRateRecord::class,
            HeartRateVariabilityRmssdRecord::class,
            ExerciseSessionRecord::class,
            OxygenSaturationRecord::class,
        )

        fun sdkAvailable(context: Context): Boolean =
            HealthConnectClient.getSdkStatus(context) == HealthConnectClient.SDK_AVAILABLE
    }
}

