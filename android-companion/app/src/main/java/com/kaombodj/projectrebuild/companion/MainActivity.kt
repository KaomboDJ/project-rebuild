package com.kaombodj.projectrebuild.companion

import android.graphics.Color
import android.os.Bundle
import android.text.InputFilter
import android.view.Gravity
import android.view.View
import android.widget.Button
import android.widget.EditText
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.activity.ComponentActivity
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.setPadding
import androidx.health.connect.client.PermissionController
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

class MainActivity : ComponentActivity() {
    private lateinit var vault: SecureTokenVault
    private lateinit var codeInput: EditText
    private lateinit var pairButton: Button
    private lateinit var permissionsButton: Button
    private lateinit var syncButton: Button
    private lateinit var backgroundButton: Button
    private lateinit var disconnectButton: Button
    private lateinit var progress: ProgressBar
    private lateinit var status: TextView

    private val healthPermissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { granted ->
        if (granted.containsAll(HealthConnectReader(this).requiredPermissions)) {
            showStatus("Leitura do Health Connect autorizada. Podes sincronizar agora.", false)
            refreshUi()
        } else {
            showStatus("Sem permissão não lemos nem enviamos dados de saúde.", true)
        }
    }

    private val backgroundPermissionLauncher = registerForActivityResult(
        PermissionController.createRequestPermissionResultContract(),
    ) { granted ->
        if (granted.contains(HealthConnectReader(this).backgroundPermission)) {
            HealthSyncWorker.schedule(this)
            showStatus("Sincronização privada em segundo plano ativada.", false)
        } else {
            HealthSyncWorker.cancel(this)
            showStatus("A sincronização automática ficou desligada. A manual continua disponível.", true)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        vault = SecureTokenVault(this)
        setContentView(buildUi())
        refreshUi()
    }

    private fun buildUi(): View {
        val content = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(24))
            setBackgroundColor(Color.rgb(8, 12, 12))
        }
        content.addView(text("Rebuild Companion", 28f, Color.WHITE).apply { contentDescription = "Rebuild Companion" })
        content.addView(text("Liga o Health Connect ao Rebuild sem guardar a tua palavra-passe. Só enviamos as métricas que autorizares.", 16f, Color.LTGRAY).withMargins(0, 8, 0, 24))

        codeInput = EditText(this).apply {
            hint = "Código de emparelhamento"
            contentDescription = "Código de emparelhamento mostrado no site Rebuild"
            setTextColor(Color.WHITE)
            setHintTextColor(Color.GRAY)
            setBackgroundColor(Color.rgb(24, 30, 30))
            filters = arrayOf(InputFilter.LengthFilter(24))
            setSingleLine(true)
            setPadding(dp(16))
        }
        content.addView(codeInput, fullWidth())
        pairButton = button("Ligar este telemóvel") { pair() }
        content.addView(pairButton, fullWidth(12))

        permissionsButton = button("Autorizar métricas no Health Connect") {
            if (!HealthConnectReader.sdkAvailable(this)) {
                showStatus("O Health Connect não está disponível neste telemóvel.", true)
            } else {
                healthPermissionLauncher.launch(HealthConnectReader(this).requiredPermissions)
            }
        }
        content.addView(permissionsButton, fullWidth(12))

        syncButton = button("Sincronizar agora") { syncNow() }
        content.addView(syncButton, fullWidth(12))

        backgroundButton = button("Ativar sincronização automática") {
            backgroundPermissionLauncher.launch(setOf(HealthConnectReader(this).backgroundPermission))
        }
        content.addView(backgroundButton, fullWidth(12))

        disconnectButton = button("Desligar e apagar acesso deste telemóvel") { disconnect() }.apply {
            setTextColor(Color.rgb(255, 170, 170))
        }
        content.addView(disconnectButton, fullWidth(20))

        progress = ProgressBar(this).apply { visibility = View.GONE; contentDescription = "A processar" }
        content.addView(progress, LinearLayout.LayoutParams(dp(44), dp(44)).apply { gravity = Gravity.CENTER; topMargin = dp(16) })
        status = text("", 15f, Color.LTGRAY).apply {
            setPadding(0, dp(16), 0, dp(24))
            accessibilityLiveRegion = View.ACCESSIBILITY_LIVE_REGION_POLITE
        }
        content.addView(status, fullWidth())

        content.addView(text("Privacidade", 18f, Color.WHITE).withMargins(0, 20, 0, 8))
        content.addView(text("• Token revogável e limitado a enviar saúde\n• Token cifrado pelo Android Keystore\n• Sem credenciais Supabase ou chaves administrativas\n• Sem anúncios, trackers ou SDKs de terceiros\n• Podes desligar o dispositivo no site a qualquer momento", 14f, Color.LTGRAY))

        return ScrollView(this).apply { addView(content); setBackgroundColor(Color.rgb(8, 12, 12)) }
    }

    private fun pair() {
        val code = codeInput.text.toString().trim()
        if (code.isBlank()) return showStatus("Introduz o código criado em Definições → Dados de saúde.", true)
        runBusy {
            val result = withContext(Dispatchers.IO) {
                RebuildApiClient().exchangePairingCode(code, RebuildApiClient.installationId(this@MainActivity))
            }
            vault.save(result.token, null)
            showStatus("Telemóvel ligado. Agora autoriza as métricas que queres partilhar.", false)
            codeInput.text.clear()
            refreshUi()
        }
    }

    private fun syncNow() = runBusy {
        val imported = SyncCoordinator(this@MainActivity).sync()
        showStatus(if (imported == 0) "Não havia dados novos para enviar." else "$imported registos sincronizados com segurança.", false)
    }

    private fun disconnect() = runBusy {
        val token = vault.token()
        if (token != null) withContext(Dispatchers.IO) { runCatching { RebuildApiClient().disconnect(token) } }
        HealthSyncWorker.cancel(this)
        vault.clear()
        showStatus("Acesso removido deste telemóvel.", false)
        refreshUi()
    }

    private fun runBusy(block: suspend () -> Unit) {
        setBusy(true)
        lifecycleScope.launch {
            try {
                block()
            } catch (error: Exception) {
                showStatus(userMessage(error), true)
            } finally {
                setBusy(false)
            }
        }
    }

    private fun userMessage(error: Exception): String = when (error.message) {
        "device-not-paired" -> "Liga primeiro este telemóvel ao Rebuild."
        "health-permission-required" -> "Autoriza primeiro as métricas no Health Connect."
        "health-connect-unavailable" -> "O Health Connect não está disponível neste dispositivo."
        else -> if (error is RebuildApiClient.ApiException && error.status == 401) {
            "O acesso expirou ou foi revogado. Cria um novo código no Rebuild."
        } else {
            "Não foi possível concluir. Confirma a internet e tenta novamente."
        }
    }

    private fun setBusy(busy: Boolean) {
        progress.visibility = if (busy) View.VISIBLE else View.GONE
        listOf(pairButton, permissionsButton, syncButton, backgroundButton, disconnectButton).forEach { it.isEnabled = !busy }
    }

    private fun refreshUi() {
        val paired = vault.token() != null
        codeInput.visibility = if (paired) View.GONE else View.VISIBLE
        pairButton.visibility = if (paired) View.GONE else View.VISIBLE
        permissionsButton.visibility = if (paired) View.VISIBLE else View.GONE
        syncButton.visibility = if (paired) View.VISIBLE else View.GONE
        backgroundButton.visibility = if (paired) View.VISIBLE else View.GONE
        disconnectButton.visibility = if (paired) View.VISIBLE else View.GONE
        if (status.text.isBlank()) showStatus(if (paired) "Este telemóvel está ligado ao Rebuild." else "Cria um código no site para começar.", false)
    }

    private fun showStatus(message: String, isError: Boolean) {
        runOnUiThread {
            status.text = message
            status.setTextColor(if (isError) Color.rgb(255, 150, 150) else Color.rgb(115, 230, 190))
        }
    }

    private fun button(label: String, action: () -> Unit) = Button(this).apply {
        text = label
        isAllCaps = false
        textSize = 16f
        setTextColor(Color.WHITE)
        setBackgroundColor(Color.rgb(0, 145, 107))
        setOnClickListener { action() }
    }

    private fun text(value: String, size: Float, color: Int) = TextView(this).apply {
        text = value
        textSize = size
        setTextColor(color)
        setLineSpacing(0f, 1.15f)
    }

    private fun View.withMargins(left: Int, top: Int, right: Int, bottom: Int): View = apply {
        layoutParams = LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT).apply {
            setMargins(dp(left), dp(top), dp(right), dp(bottom))
        }
    }

    private fun fullWidth(topMargin: Int = 0) = LinearLayout.LayoutParams(
        LinearLayout.LayoutParams.MATCH_PARENT,
        LinearLayout.LayoutParams.WRAP_CONTENT,
    ).apply { this.topMargin = dp(topMargin) }

    private fun dp(value: Int) = (value * resources.displayMetrics.density).toInt()
}
