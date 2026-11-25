package es.progaraje.app

import android.Manifest
import android.app.AlarmManager
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import org.json.JSONArray
import org.json.JSONObject
import java.util.Calendar

/**
 * Avisos de ITV, seguro, aceite, neumáticos…
 * La pantalla (app.js) calcula cuándo vence cada cosa y manda la lista aquí.
 * Una alarma diaria (a la hora elegida) revisa la lista y lanza las notificaciones,
 * aunque la app esté cerrada.
 */
object Reminders {

    private const val CHANNEL = "avisos"
    private const val DAY = 24L * 60 * 60 * 1000

    fun prefs(c: Context) = c.getSharedPreferences("progaraje", Context.MODE_PRIVATE)

    /** Lista de avisos: [{id, title, body, due}] (due = milisegundos de la fecha de vencimiento). */
    fun save(c: Context, json: String, days: String, hour: Int) {
        prefs(c).edit()
            .putString("reminders", json)
            .putString("notifyDays", days)
            .putInt("hour", hour.coerceIn(0, 23))
            .apply()
        schedule(c)
    }

    private fun startOfDay(t: Long): Long {
        val cal = Calendar.getInstance()
        cal.timeInMillis = t
        cal.set(Calendar.HOUR_OF_DAY, 0)
        cal.set(Calendar.MINUTE, 0)
        cal.set(Calendar.SECOND, 0)
        cal.set(Calendar.MILLISECOND, 0)
        return cal.timeInMillis
    }

    private fun todayKey(): String {
        val cal = Calendar.getInstance()
        return "${cal.get(Calendar.YEAR)}-${cal.get(Calendar.DAY_OF_YEAR)}"
    }

    /** Programa la próxima revisión diaria. */
    fun schedule(c: Context) {
        try {
            val hour = prefs(c).getInt("hour", 9)
            val cal = Calendar.getInstance()
            cal.set(Calendar.HOUR_OF_DAY, hour)
            cal.set(Calendar.MINUTE, 0)
            cal.set(Calendar.SECOND, 0)
            cal.set(Calendar.MILLISECOND, 0)
            if (cal.timeInMillis <= System.currentTimeMillis() + 60_000) cal.add(Calendar.DAY_OF_YEAR, 1)
            val am = c.getSystemService(Context.ALARM_SERVICE) as AlarmManager
            am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, cal.timeInMillis, alarmIntent(c))
        } catch (_: Exception) {
        }
    }

    private fun alarmIntent(c: Context): PendingIntent {
        val i = Intent(c, AlarmReceiver::class.java).setAction("es.progaraje.app.CHECK")
        return PendingIntent.getBroadcast(c, 5, i, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }

    private fun ensureChannel(c: Context) {
        val nm = c.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        if (nm.getNotificationChannel(CHANNEL) == null) {
            val ch = NotificationChannel(CHANNEL, "Avisos del coche", NotificationManager.IMPORTANCE_HIGH)
            ch.description = "ITV, seguro, aceite, neumáticos y demás mantenimientos"
            nm.createNotificationChannel(ch)
        }
    }

    fun canNotify(c: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 33 &&
            ContextCompat.checkSelfPermission(c, Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        ) return false
        return NotificationManagerCompat.from(c).areNotificationsEnabled()
    }

    fun notify(c: Context, id: Int, title: String, body: String) {
        if (!canNotify(c)) return
        ensureChannel(c)
        val open = Intent(c, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
        val pi = PendingIntent.getActivity(c, id, open, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        val n = NotificationCompat.Builder(c, CHANNEL)
            .setSmallIcon(R.drawable.ic_stat)
            .setColor(0xFF3EE7FF.toInt())
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setContentIntent(pi)
            .setAutoCancel(true)
            .build()
        try {
            NotificationManagerCompat.from(c).notify(id, n)
        } catch (_: SecurityException) {
        }
    }

    /** Revisa los vencimientos y avisa de los que tocan hoy (una sola vez al día por cada cosa). */
    fun check(c: Context) {
        val p = prefs(c)
        val list = try { JSONArray(p.getString("reminders", "[]")) } catch (_: Exception) { JSONArray() }
        val days = (p.getString("notifyDays", "30,7,1") ?: "30,7,1")
            .split(",").mapNotNull { it.trim().toIntOrNull() }.toSet()
        val done = try { JSONObject(p.getString("notified", "{}")) } catch (_: Exception) { JSONObject() }
        val today = todayKey()
        val start = startOfDay(System.currentTimeMillis())
        var changed = false
        for (i in 0 until list.length()) {
            val r = list.optJSONObject(i) ?: continue
            val id = r.optString("id")
            val due = r.optLong("due", 0L)
            if (id.isEmpty() || due <= 0L) continue
            val left = Math.floorDiv(startOfDay(due) - start, DAY).toInt()
            val toca = left == 0 || days.contains(left) || (left < 0 && (-left) % 3 == 0)
            if (!toca || done.optString(id) == today) continue
            val cuando = when {
                left > 1 -> "Faltan $left días"
                left == 1 -> "Es mañana"
                left == 0 -> "Es hoy"
                left == -1 -> "Venció ayer"
                else -> "Venció hace ${-left} días"
            }
            val extra = r.optString("body")
            notify(c, 1000 + (id.hashCode() and 0xFFFF), r.optString("title", "Pro Garaje"),
                if (extra.isEmpty()) cuando else "$cuando · $extra")
            done.put(id, today)
            changed = true
        }
        if (changed) p.edit().putString("notified", done.toString()).apply()
    }

    class AlarmReceiver : BroadcastReceiver() {
        override fun onReceive(context: Context, intent: Intent) {
            try {
                check(context)
            } finally {
                schedule(context)
            }
        }
    }
}
