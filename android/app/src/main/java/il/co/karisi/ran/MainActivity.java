package il.co.karisi.ran;

import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
  private final Handler main = new Handler(Looper.getMainLooper());
  @Override public void onCreate(Bundle b) {
    registerPlugin(RanCapturePlugin.class);
    super.onCreate(b);
    immersive();
  }
  @Override public void onPause() {
    try {
      if (getBridge() != null && getBridge().getWebView() != null)
        getBridge().getWebView().evaluateJavascript("window.__rkFlush&&window.__rkFlush()", null);
    } catch (Throwable ignored) {}
    super.onPause();
  }
  // Hide bars on the next turn. Doing it inside this callback holds the window
  // lock while a photo-picker result is delivered, and Android 16 then denies the URI.
  @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) main.post(this::immersive); }
  private void immersive() {
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    WindowInsetsControllerCompat c = WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.hide(WindowInsetsCompat.Type.systemBars());
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
  }
}
