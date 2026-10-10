package com.charles.careeros.companion

import android.app.Application
import com.charles.careeros.companion.challenge.Session

class CompanionApp : Application() {
    lateinit var session: Session
        private set
    override fun onCreate() { super.onCreate(); session = Session(this) }
}
