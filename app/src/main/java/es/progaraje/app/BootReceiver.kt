package es.progaraje.app

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Al encender el móvil (o tras actualizar la app) vuelve a programar la revisión diaria de avisos. */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        Reminders.schedule(context)
    }
}
