package com.riki2025.appvendedores

import com.facebook.react.ReactActivity
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  // Debe coincidir con lo que registra Expo Router (index.js usa "expo-router/entry")
  override fun getMainComponentName(): String = "main"

  override fun createReactActivityDelegate() =
    DefaultReactActivityDelegate(
      this,
      mainComponentName,
      DefaultNewArchitectureEntryPoint.fabricEnabled
    )
}
