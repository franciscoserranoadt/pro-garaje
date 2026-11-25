package es.progaraje.app

import android.Manifest
import android.annotation.SuppressLint
import android.app.Activity
import android.app.AlertDialog
import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageInstaller
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.os.Handler
import android.os.Looper
import android.provider.MediaStore
import android.provider.Settings
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.core.content.ContextCompat
import org.json.JSONObject

class MainActivity : Activity() {

    private lateinit var web: WebView
    private var pageReady = false
    private val handler = Handler(Looper.getMainLooper())
    private val prefs by lazy { getSharedPreferences("progaraje", Context.MODE_PRIVATE) }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        web = WebView(this)
        web.setBackgroundColor(0xFF0B1220.toInt())
        web.settings.javaScriptEnabled = true
        web.settings.domStorageEnabled = true
        web.settings.allowFileAccess = true
        web.settings.textZoom = 100
        web.isVerticalScrollBarEnabled = false
        web.overScrollMode = View.OVER_SCROLL_NEVER
        web.webChromeClient = WebChromeClient()
        web.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                pageReady = true
            }
        }
        web.addJavascriptInterface(Bridge(), "Android")
        web.loadUrl("file:///android_asset/index.html")
        setContentView(web)

        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) requestPermissions(arrayOf(Manifest.permission.POST_NOTIFICATIONS), 1)

        Reminders.schedule(this)
        handler.postDelayed({ checkUpdate(false) }, 5000)
    }

    override fun onResume() {
        super.onResume()
        js("PG.onResume && PG.onResume()")
    }

    @Deprecated("Deprecated in Java")
    override fun onBackPressed() {
        // Primero deja que la pantalla cierre ventanas abiertas; si no hay ninguna, sale.
        if (!pageReady) { super.onBackPressed(); return }
        web.evaluateJavascript("window.PG ? PG.back() : false") { r ->
            if (r != "true") finish()
        }
    }

    private fun js(code: String) {
        if (!pageReady) return
        runOnUiThread { web.evaluateJavascript("window.PG && $code", null) }
    }

    private fun toast(msg: String) = js("PG.toast(" + JSONObject.quote(msg) + ")")

    // ---------- Copia de seguridad ----------

    private fun exportFile(name: String, text: String): Boolean {
        return try {
            if (Build.VERSION.SDK_INT >= 29) {
                val values = ContentValues().apply {
                    put(MediaStore.Downloads.DISPLAY_NAME, name)
                    put(MediaStore.Downloads.MIME_TYPE, "application/json")
                    put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
                }
                val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return false
                contentResolver.openOutputStream(uri)?.use { it.write(text.toByteArray(Charsets.UTF_8)) } ?: return false
            } else {
                // Android 9 o anterior (pantallas de coche antiguas): guardar en Descargas con el permiso clásico.
                if (checkSelfPermission(Manifest.permission.WRITE_EXTERNAL_STORAGE) != PackageManager.PERMISSION_GRANTED) {
                    requestPermissions(arrayOf(Manifest.permission.WRITE_EXTERNAL_STORAGE), 2)
                    toast("Da permiso de almacenamiento y vuelve a pulsar «Guardar copia»")
                    return true
                }
                @Suppress("DEPRECATION")
                val dir = Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS)
                dir.mkdirs()
                java.io.File(dir, name).writeText(text, Charsets.UTF_8)
            }
            true
        } catch (_: Exception) {
            false
        }
    }

    @Deprecated("Deprecated in Java")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode == 42 && resultCode == RESULT_OK) {
            val uri = data?.data ?: return
            try {
                val text = contentResolver.openInputStream(uri)?.bufferedReader()?.use { it.readText() } ?: ""
                js("PG.onImport(" + JSONObject.quote(text) + ")")
            } catch (_: Exception) {
                toast("No se pudo leer el archivo")
            }
        }
    }

    // ---------- Actualizaciones (igual que Pro Maps y Pro Radio) ----------

    private fun checkUpdate(manual: Boolean) {
        if (manual) toast("Buscando actualizaciones…")
        Thread {
            val info = Updater.latest()
            val mine = Updater.installedCode(this)
            handler.post {
                if (isFinishing) return@post
                if (info == null) {
                    if (manual) toast("No se pudo comprobar. ¿Tienes internet?")
                    return@post
                }
                if (info.code <= mine) {
                    if (manual) toast("Ya tienes la última versión (v" + Updater.installedName(this) + ")")
                    return@post
                }
                if (!manual && prefs.getInt("skipVersion", 0) == info.code) return@post
                AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                    .setTitle("Hay una versión nueva")
                    .setMessage(
                        "Pro Garaje v" + info.name + " ya está disponible (tienes la v" + Updater.installedName(this) + ")." +
                                (if (info.notes.isEmpty()) "" else "\n\nNovedades:\n" + info.notes) +
                                "\n\nTus datos (mantenimientos y repostajes) se mantienen."
                    )
                    .setPositiveButton("Actualizar") { _, _ -> startUpdate() }
                    .setNeutralButton("Esta no") { _, _ -> prefs.edit().putInt("skipVersion", info.code).apply() }
                    .setNegativeButton("Más tarde", null)
                    .show()
            }
        }.start()
    }

    private fun startUpdate() {
        if (Build.VERSION.SDK_INT >= 26 && !packageManager.canRequestPackageInstalls()) {
            AlertDialog.Builder(this, android.R.style.Theme_Material_Dialog_Alert)
                .setTitle("Falta un permiso")
                .setMessage(
                    "Para actualizarse, Android tiene que permitir que Pro Garaje instale apps.\n\n" +
                            "En la siguiente pantalla activa «Permitir de esta fuente», vuelve atrás y pulsa otra vez Actualizar."
                )
                .setPositiveButton("Abrir ajustes") { _, _ ->
                    try {
                        startActivity(Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:$packageName")))
                    } catch (_: Exception) {
                    }
                }
                .setNegativeButton("Cancelar", null)
                .show()
            return
        }
        toast("Descargando la versión nueva…")
        Thread {
            val err = Updater.downloadAndInstall(this)
            if (err != null) handler.post { toast(err) }
        }.start()
    }

    override fun onNewIntent(intent: Intent?) {
        super.onNewIntent(intent)
        if (intent == null || intent.action != Updater.ACTION_STATUS) return
        val status = intent.getIntExtra(PackageInstaller.EXTRA_STATUS, -999)
        if (status == PackageInstaller.STATUS_PENDING_USER_ACTION) {
            @Suppress("DEPRECATION")
            val confirm = intent.getParcelableExtra<Intent>(Intent.EXTRA_INTENT)
            if (confirm != null) {
                try {
                    startActivity(confirm.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                } catch (_: Exception) {
                }
            }
        } else if (status != PackageInstaller.STATUS_SUCCESS) {
            val msg = intent.getStringExtra(PackageInstaller.EXTRA_STATUS_MESSAGE)
            toast("No se pudo instalar" + if (msg == null) "" else ": $msg")
        }
    }

    // ---------- Puente con la pantalla (JavaScript) ----------

    inner class Bridge {
        /** Todos los datos de la app (coche, mantenimientos, repostajes) en un JSON. */
        @JavascriptInterface
        fun load(): String = prefs.getString("data", "") ?: ""

        @JavascriptInterface
        fun save(json: String) {
            prefs.edit().putString("data", json).apply()
        }

        @JavascriptInterface
        fun setReminders(json: String, days: String, hour: Int) {
            Reminders.save(this@MainActivity, json, days, hour)
            Reminders.check(this@MainActivity)
        }

        @JavascriptInterface
        fun testNotification() {
            if (!Reminders.canNotify(this@MainActivity)) {
                runOnUiThread { openNotificationSettings() }
                return
            }
            Reminders.notify(this@MainActivity, 999, "Pro Garaje", "Así te llegarán los avisos de ITV, seguro, aceite y neumáticos.")
        }

        @JavascriptInterface
        fun notificationsOn(): Boolean = Reminders.canNotify(this@MainActivity)

        @JavascriptInterface
        fun openNotificationSettings() = runOnUiThread { this@MainActivity.openNotificationSettings() }

        @JavascriptInterface
        fun exportBackup(name: String, text: String): Boolean = exportFile(name, text)

        @JavascriptInterface
        fun importBackup() = runOnUiThread {
            try {
                val i = Intent(Intent.ACTION_OPEN_DOCUMENT)
                    .addCategory(Intent.CATEGORY_OPENABLE)
                    .setType("*/*")
                @Suppress("DEPRECATION")
                startActivityForResult(i, 42)
            } catch (_: Exception) {
                toast("No se pudo abrir el selector de archivos")
            }
        }

        @JavascriptInterface
        fun dial(phone: String) = runOnUiThread {
            try {
                startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:" + phone.replace(" ", ""))))
            } catch (_: Exception) {
                toast("No se pudo abrir el teléfono")
            }
        }

        @JavascriptInterface
        fun openUrl(url: String) = runOnUiThread {
            try {
                startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(url)).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
            } catch (_: Exception) {
                toast("No hay ninguna app para abrir el enlace")
            }
        }

        @JavascriptInterface
        fun version(): String = Updater.installedName(this@MainActivity)

        @JavascriptInterface
        fun checkUpdate() = runOnUiThread { this@MainActivity.checkUpdate(true) }
    }

    private fun openNotificationSettings() {
        try {
            startActivity(
                Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS)
                    .putExtra(Settings.EXTRA_APP_PACKAGE, packageName)
            )
        } catch (_: Exception) {
            try {
                startActivity(Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS, Uri.parse("package:$packageName")))
            } catch (_: Exception) {
            }
        }
    }
}
