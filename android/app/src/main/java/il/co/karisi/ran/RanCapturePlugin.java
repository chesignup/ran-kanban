package il.co.karisi.ran;

import android.Manifest;
import android.app.Activity;
import android.content.ClipData;
import android.content.ContentResolver;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.database.Cursor;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.ImageDecoder;
import android.graphics.Matrix;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.ContactsContract;
import android.provider.MediaStore;
import android.provider.OpenableColumns;
import android.util.Base64;
import androidx.activity.result.ActivityResult;
import androidx.core.content.FileProvider;
import androidx.exifinterface.media.ExifInterface;
import com.getcapacitor.JSArray;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileNotFoundException;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.nio.ByteBuffer;
import android.os.ParcelFileDescriptor;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Camera / photo-picker / file reads for Android 16.
 *
 * The system Photo Picker returns a content:// URI. Opening it inside the
 * activity-result callback fails on Android 16 / One UI: "Unable to check Uri
 * permission because caller is holding WM lock; assuming permission denied".
 * Bytes are copied on a background thread after that callback returns.
 *
 * "צלם" must be a real camera intent (FileProvider EXTRA_OUTPUT + clip-data
 * grant), not the photo picker. Gallery and files stay separate actions.
 */
@CapacitorPlugin(
    name = "RanCapture",
    permissions = {
        @Permission(strings = { Manifest.permission.CAMERA }, alias = "camera"),
        @Permission(strings = { Manifest.permission.READ_CONTACTS }, alias = "contacts")
    }
)
public class RanCapturePlugin extends Plugin {
    private static final int MAX_BYTES = 25 * 1024 * 1024;
    private static final String[] KNOWN_CAMERAS = {
        "com.sec.android.app.camera",
        "com.samsung.android.app.camera",
        "com.samsung.android.camera",
        "com.google.android.GoogleCamera",
        "com.android.camera",
        "com.android.camera2",
        "com.huawei.camera",
        "com.motorola.camera2",
        "com.oppo.camera",
        "com.oneplus.camera"
    };

    private final ExecutorService worker = Executors.newSingleThreadExecutor();
    private String cameraOutPath;

    @PluginMethod
    public void capture(PluginCall call) {
        call.setKeepAlive(true);
        String source = call.getString("source", "photos");
        if ("camera".equals(source)) {
            if (getPermissionState("camera") != PermissionState.GRANTED) {
                requestPermissionForAlias("camera", call, "onPerm");
                return;
            }
            openCamera(call);
            return;
        }
        if ("file".equals(source)) {
            openFiles(call);
            return;
        }
        openPhotos(call);
    }

    @PluginMethod
    public void pickContact(PluginCall call) {
        if (getPermissionState("contacts") != PermissionState.GRANTED) {
            requestPermissionForAlias("contacts", call, "onPerm");
            return;
        }
        launchContact(call);
    }

    @PermissionCallback
    private void onPerm(PluginCall call) {
        if (call == null) return;
        String method = call.getMethodName();
        if ("pickContact".equals(method)) {
            if (getPermissionState("contacts") != PermissionState.GRANTED) {
                call.reject("permission denied");
                return;
            }
            launchContact(call);
            return;
        }
        if (getPermissionState("camera") != PermissionState.GRANTED) {
            call.reject("permission denied");
            return;
        }
        openCamera(call);
    }

    private void openCamera(PluginCall call) {
        try {
            File dir = new File(getContext().getCacheDir(), "captures");
            if (!dir.exists() && !dir.mkdirs()) {
                call.reject("camera dir");
                return;
            }
            File photo = new File(dir, "cap_" + System.currentTimeMillis() + ".jpg");
            if (!photo.exists() && !photo.createNewFile()) {
                call.reject("camera file");
                return;
            }
            String authority = getContext().getPackageName() + ".fileprovider";
            Uri output = FileProvider.getUriForFile(getContext(), authority, photo);
            cameraOutPath = photo.getAbsolutePath();
            call.getData().put("outPath", cameraOutPath);
            getContext().getSharedPreferences("ran_capture", Activity.MODE_PRIVATE)
                .edit().putString("out", cameraOutPath).apply();
            Intent intent = cameraIntent(output);
            launchWhenIdle(call, intent, "onCamera");
        } catch (Exception e) {
            call.reject(e.getMessage() == null ? "camera failed" : e.getMessage());
        }
    }

    private Intent cameraIntent(Uri output) {
        Intent intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        intent.putExtra(MediaStore.EXTRA_OUTPUT, output);
        intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.setClipData(ClipData.newRawUri("capture", output));
        PackageManager pm = getContext().getPackageManager();
        List<ResolveInfo> infos = pm.queryIntentActivities(intent, PackageManager.MATCH_DEFAULT_ONLY);
        String cameraPkg = null;
        String otherPkg = null;
        for (ResolveInfo info : infos) {
            if (info.activityInfo == null || info.activityInfo.packageName == null) continue;
            String pkg = info.activityInfo.packageName;
            getContext().grantUriPermission(pkg, output, Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
            if (isPickerPackage(pkg)) continue;
            if (pkg.toLowerCase(Locale.US).contains("camera")) {
                cameraPkg = pkg;
                break;
            }
            if (otherPkg == null) otherPkg = pkg;
        }
        String use = cameraPkg != null ? cameraPkg : otherPkg;
        if (use == null) {
            for (String pkg : KNOWN_CAMERAS) {
                Intent probe = new Intent(intent);
                probe.setPackage(pkg);
                if (probe.resolveActivity(pm) != null) {
                    use = pkg;
                    getContext().grantUriPermission(pkg, output, Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    break;
                }
            }
        }
        if (use != null) intent.setPackage(use);
        return intent;
    }

    private static boolean isPickerPackage(String pkg) {
        String l = pkg.toLowerCase(Locale.US);
        return l.contains("photopicker") || l.contains("photos") || l.contains("gallery")
            || l.contains("media.module") || l.contains("documentsui") || l.contains("providers.media");
    }

    private void openPhotos(PluginCall call) {
        Intent intent;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            intent = new Intent(MediaStore.ACTION_PICK_IMAGES);
            intent.setType("image/*");
        } else {
            intent = new Intent(Intent.ACTION_GET_CONTENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("image/*");
        }
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        launchWhenIdle(call, intent, "onPicked");
    }

    private void openFiles(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
        intent.addCategory(Intent.CATEGORY_OPENABLE);
        intent.setType("*/*");
        intent.putExtra(Intent.EXTRA_ALLOW_MULTIPLE, true);
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        launchWhenIdle(call, intent, "onFiles");
    }

    private void launchContact(PluginCall call) {
        Intent intent = new Intent(Intent.ACTION_PICK);
        intent.setDataAndType(
            ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
            ContactsContract.CommonDataKinds.Phone.CONTENT_TYPE
        );
        launchWhenIdle(call, intent, "onContact");
    }

    /** Start after the current result / permission turn so the WM lock is released. */
    private void launchWhenIdle(PluginCall call, Intent intent, String callback) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject("no activity");
            return;
        }
        activity.runOnUiThread(() -> new Handler(Looper.getMainLooper()).post(() -> {
            try {
                startActivityForResult(call, intent, callback);
            } catch (Exception first) {
                if ("onCamera".equals(callback)) {
                    try {
                        intent.setPackage(null);
                        startActivityForResult(call, intent, callback);
                        return;
                    } catch (Exception ignored) {}
                }
                if (!"onContact".equals(callback)) {
                    call.reject(first.getMessage() == null ? "launch failed" : first.getMessage());
                    return;
                }
                try {
                    Intent fallback = new Intent(Intent.ACTION_PICK, ContactsContract.Contacts.CONTENT_URI);
                    startActivityForResult(call, fallback, callback);
                } catch (Exception second) {
                    call.reject(second.getMessage() == null ? "contacts unavailable" : second.getMessage());
                }
            }
        }));
    }

    @ActivityCallback
    private void onCamera(PluginCall call, ActivityResult result) {
        if (call == null) return;
        String path = call.getString("outPath");
        if (path == null || path.isEmpty()) path = cameraOutPath;
        if (path == null || path.isEmpty()) {
            path = getContext().getSharedPreferences("ran_capture", Activity.MODE_PRIVATE).getString("out", null);
        }
        final String out = path;
        File file = out == null ? null : new File(out);
        boolean wrote = file != null && file.exists() && file.length() > 0;
        if (!wrote && (result == null || result.getResultCode() != Activity.RESULT_OK)) {
            if (file != null) file.delete();
            call.reject("User cancelled");
            return;
        }
        final Intent data = result == null ? null : result.getData();
        new Handler(Looper.getMainLooper()).postDelayed(() -> worker.execute(() -> {
            try {
                byte[] raw = null;
                if (wrote) raw = readFileCapped(file);
                if ((raw == null || raw.length == 0) && data != null && data.getData() != null) raw = readUri(data.getData());
                if ((raw == null || raw.length == 0) && data != null && data.getExtras() != null) {
                    Bitmap thumb = extrasBitmap(data.getExtras());
                    if (thumb != null) raw = bitmapJpeg(thumb, call.getInt("quality", 80));
                }
                if (raw == null || raw.length == 0) {
                    reject(call, "empty photo");
                    return;
                }
                resolvePhoto(call, raw);
            } catch (Exception e) {
                reject(call, e.getMessage() == null ? "empty photo" : e.getMessage());
            }
        }), 120);
    }

    @ActivityCallback
    private void onPicked(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("User cancelled");
            return;
        }
        Uri uri = firstUri(result.getData());
        if (uri == null) {
            call.reject("empty photo");
            return;
        }
        final Uri picked = uri;
        try {
            Activity act = getActivity();
            if (act != null) {
                act.grantUriPermission(getContext().getPackageName(), picked, Intent.FLAG_GRANT_READ_URI_PERMISSION);
            }
        } catch (Exception ignored) {}
        // Leave onActivityResult before touching the URI (WM-lock grant bug).
        new Handler(Looper.getMainLooper()).postDelayed(() -> worker.execute(() -> {
            try {
                byte[] raw = copyUriToCache(picked);
                if (raw == null || raw.length == 0) raw = readUri(picked);
                resolvePhoto(call, raw);
            } catch (Exception e) {
                reject(call, e.getMessage() == null ? "empty photo" : e.getMessage());
            }
        }), 120);
    }

    @ActivityCallback
    private void onFiles(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null) {
            call.reject("User cancelled");
            return;
        }
        final List<Uri> uris = allUris(result.getData());
        if (uris.isEmpty()) {
            call.reject("User cancelled");
            return;
        }
        Activity act = getActivity();
        for (Uri uri : uris) {
            try {
                if (act != null) {
                    act.grantUriPermission(getContext().getPackageName(), uri, Intent.FLAG_GRANT_READ_URI_PERMISSION);
                }
            } catch (Exception ignored) {}
        }
        new Handler(Looper.getMainLooper()).postDelayed(() -> worker.execute(() -> {
            try {
                JSArray files = new JSArray();
                ContentResolver cr = getContext().getContentResolver();
                for (Uri uri : uris) {
                    byte[] raw = readUri(uri);
                    String mime = cr.getType(uri);
                    if (mime == null) mime = "application/octet-stream";
                    String name = displayName(uri);
                    String data;
                    String outMime = mime;
                    if (mime.startsWith("image/")) {
                        String jpeg = jpegBase64(raw, call.getInt("quality", 80), call.getInt("width", 2000));
                        if (jpeg != null) {
                            data = jpeg;
                            outMime = "image/jpeg";
                            if (name == null || !name.contains(".")) name = "photo_" + System.currentTimeMillis() + ".jpg";
                        } else data = Base64.encodeToString(raw, Base64.NO_WRAP);
                    } else data = Base64.encodeToString(raw, Base64.NO_WRAP);
                    JSObject one = new JSObject();
                    one.put("data", data);
                    one.put("name", name == null ? "file" : name);
                    one.put("mimeType", outMime);
                    files.put(one);
                }
                JSObject ret = new JSObject();
                ret.put("files", files);
                resolve(call, ret);
            } catch (Exception e) {
                reject(call, e.getMessage() == null ? "unreadable file" : e.getMessage());
            }
        }), 120);
    }

    @ActivityCallback
    private void onContact(PluginCall call, ActivityResult result) {
        if (call == null) return;
        if (result == null || result.getResultCode() != Activity.RESULT_OK || result.getData() == null || result.getData().getData() == null) {
            call.reject("User cancelled");
            return;
        }
        final Uri uri = result.getData().getData();
        new Handler(Looper.getMainLooper()).post(() -> worker.execute(() -> {
            try {
                JSObject contact = readContact(uri);
                JSObject ret = new JSObject();
                ret.put("contact", contact);
                resolve(call, ret);
            } catch (Exception e) {
                reject(call, e.getMessage() == null ? "contact failed" : e.getMessage());
            }
        }));
    }

    private void resolvePhoto(PluginCall call, byte[] raw) {
        int quality = call.getInt("quality", 80);
        int width = call.getInt("width", 2000);
        String encoded = jpegBase64(raw, quality, width);
        if (encoded == null) {
            reject(call, "empty photo");
            return;
        }
        JSObject ret = new JSObject();
        ret.put("base64String", encoded);
        ret.put("format", "jpeg");
        resolve(call, ret);
    }

    private JSObject readContact(Uri uri) {
        String number = null;
        String name = null;
        ContentResolver cr = getContext().getContentResolver();
        Cursor c = cr.query(uri, new String[] {
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME
        }, null, null, null);
        if (c != null) {
            if (c.moveToFirst()) {
                int ni = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                int di = c.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                if (ni >= 0) number = c.getString(ni);
                if (di >= 0) name = c.getString(di);
            }
            c.close();
        }
        if (number == null && uri.getLastPathSegment() != null) {
            Cursor p = cr.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                new String[] { ContactsContract.CommonDataKinds.Phone.NUMBER, ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME },
                ContactsContract.CommonDataKinds.Phone.CONTACT_ID + "=?",
                new String[] { uri.getLastPathSegment() },
                null
            );
            if (p != null) {
                if (p.moveToFirst()) {
                    int ni = p.getColumnIndex(ContactsContract.CommonDataKinds.Phone.NUMBER);
                    int di = p.getColumnIndex(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME);
                    if (ni >= 0) number = p.getString(ni);
                    if (di >= 0) name = p.getString(di);
                }
                p.close();
            }
            if (name == null) {
                Cursor n = cr.query(uri, new String[] { ContactsContract.Contacts.DISPLAY_NAME }, null, null, null);
                if (n != null) {
                    if (n.moveToFirst()) {
                        int di = n.getColumnIndex(ContactsContract.Contacts.DISPLAY_NAME);
                        if (di >= 0) name = n.getString(di);
                    }
                    n.close();
                }
            }
        }
        JSObject contact = new JSObject();
        JSObject nm = new JSObject();
        nm.put("display", name == null ? "" : name);
        contact.put("name", nm);
        JSArray phones = new JSArray();
        if (number != null && !number.isEmpty()) {
            JSObject ph = new JSObject();
            ph.put("number", number);
            phones.put(ph);
        }
        contact.put("phones", phones);
        return contact;
    }

    private String displayName(Uri uri) {
        Cursor c = getContext().getContentResolver().query(uri, new String[] { OpenableColumns.DISPLAY_NAME }, null, null, null);
        if (c == null) return null;
        try {
            if (!c.moveToFirst()) return null;
            int i = c.getColumnIndex(OpenableColumns.DISPLAY_NAME);
            return i >= 0 ? c.getString(i) : null;
        } finally {
            c.close();
        }
    }

    private static Uri firstUri(Intent data) {
        List<Uri> all = allUris(data);
        return all.isEmpty() ? null : all.get(0);
    }

    private static List<Uri> allUris(Intent data) {
        List<Uri> out = new ArrayList<>();
        ClipData clip = data.getClipData();
        if (clip != null) {
            for (int i = 0; i < clip.getItemCount(); i++) {
                Uri u = clip.getItemAt(i).getUri();
                if (u != null) out.add(u);
            }
        }
        if (out.isEmpty() && data.getData() != null) out.add(data.getData());
        return out;
    }

    private byte[] copyUriToCache(Uri uri) {
        try {
            byte[] raw = readUri(uri);
            if (raw == null || raw.length == 0) return raw;
            File dir = new File(getContext().getCacheDir(), "captures");
            if (!dir.exists() && !dir.mkdirs()) return raw;
            File out = new File(dir, "pick_" + System.currentTimeMillis() + ".bin");
            try (FileOutputStream fos = new FileOutputStream(out)) {
                fos.write(raw);
            }
            return readFileCapped(out);
        } catch (Exception e) {
            return null;
        }
    }

    @SuppressWarnings("deprecation")
    private static Bitmap extrasBitmap(Bundle extras) {
        if (extras == null) return null;
        if (Build.VERSION.SDK_INT >= 33) {
            return extras.getParcelable("data", Bitmap.class);
        }
        return extras.getParcelable("data");
    }

    private byte[] readUri(Uri uri) throws Exception {
        Exception last = new Exception("unreadable");
        ContentResolver cr = getContext().getContentResolver();
        for (int i = 0; i < 6; i++) {
            try {
                InputStream in = cr.openInputStream(uri);
                if (in == null) throw new IllegalStateException("null stream");
                try {
                    return readStream(in);
                } finally {
                    in.close();
                }
            } catch (SecurityException | FileNotFoundException | IllegalStateException e) {
                last = e;
                try { Thread.sleep(40L * (i + 1)); } catch (InterruptedException ie) { break; }
            }
        }
        try {
            ParcelFileDescriptor pfd = cr.openFileDescriptor(uri, "r");
            if (pfd != null) {
                try (FileInputStream in = new FileInputStream(pfd.getFileDescriptor())) {
                    return readStream(in);
                } finally {
                    pfd.close();
                }
            }
        } catch (Exception e) {
            last = e;
        }
        throw last;
    }

    private byte[] readFileCapped(File file) throws Exception {
        try (InputStream in = new FileInputStream(file)) {
            return readStream(in);
        }
    }

    private byte[] readStream(InputStream in) throws Exception {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        byte[] buf = new byte[16384];
        int n;
        int total = 0;
        while ((n = in.read(buf)) >= 0) {
            total += n;
            if (total > MAX_BYTES) throw new IllegalStateException("file too large");
            out.write(buf, 0, n);
        }
        return out.toByteArray();
    }

    private String jpegBase64(byte[] raw, int quality, int maxW) {
        if (quality <= 0 || quality > 100) quality = 80;
        Bitmap bmp = decodeBitmap(raw, maxW);
        if (bmp == null) return null;
        try {
            if (maxW > 0 && bmp.getWidth() > maxW) {
                int h = Math.max(1, bmp.getHeight() * maxW / bmp.getWidth());
                Bitmap scaled = Bitmap.createScaledBitmap(bmp, maxW, h, true);
                if (scaled != bmp) bmp.recycle();
                bmp = scaled;
            }
            return Base64.encodeToString(bitmapJpeg(bmp, quality), Base64.NO_WRAP);
        } finally {
            if (bmp != null && !bmp.isRecycled()) bmp.recycle();
        }
    }

    private Bitmap decodeBitmap(byte[] raw, int maxW) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            try {
                ImageDecoder.Source src = ImageDecoder.createSource(ByteBuffer.wrap(raw));
                Bitmap bmp = ImageDecoder.decodeBitmap(src, (decoder, info, source) -> {
                    decoder.setAllocator(ImageDecoder.ALLOCATOR_SOFTWARE);
                    if (maxW > 0 && info.getSize().getWidth() > maxW) {
                        float r = (float) maxW / info.getSize().getWidth();
                        int h = Math.max(1, Math.round(info.getSize().getHeight() * r));
                        decoder.setTargetSize(maxW, h);
                    }
                });
                if (bmp != null) return bmp;
            } catch (Exception ignored) {}
        }
        BitmapFactory.Options bounds = new BitmapFactory.Options();
        bounds.inJustDecodeBounds = true;
        BitmapFactory.decodeByteArray(raw, 0, raw.length, bounds);
        if (bounds.outWidth <= 0 || bounds.outHeight <= 0) return null;
        int sample = 1;
        int w = bounds.outWidth;
        while (maxW > 0 && w / sample > maxW * 2) sample *= 2;
        BitmapFactory.Options opts = new BitmapFactory.Options();
        opts.inSampleSize = sample;
        Bitmap bmp = BitmapFactory.decodeByteArray(raw, 0, raw.length, opts);
        if (bmp == null) return null;
        try {
            return applyExif(bmp, raw);
        } catch (Exception e) {
            return bmp;
        }
    }

    private byte[] bitmapJpeg(Bitmap bmp, int quality) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        bmp.compress(Bitmap.CompressFormat.JPEG, quality, out);
        return out.toByteArray();
    }

    private Bitmap applyExif(Bitmap bmp, byte[] raw) {
        try {
            ExifInterface exif = new ExifInterface(new ByteArrayInputStream(raw));
            int o = exif.getAttributeInt(ExifInterface.TAG_ORIENTATION, ExifInterface.ORIENTATION_NORMAL);
            Matrix m = new Matrix();
            switch (o) {
                case ExifInterface.ORIENTATION_ROTATE_90: m.postRotate(90); break;
                case ExifInterface.ORIENTATION_ROTATE_180: m.postRotate(180); break;
                case ExifInterface.ORIENTATION_ROTATE_270: m.postRotate(270); break;
                case ExifInterface.ORIENTATION_FLIP_HORIZONTAL: m.preScale(-1, 1); break;
                case ExifInterface.ORIENTATION_FLIP_VERTICAL: m.preScale(1, -1); break;
                default: return bmp;
            }
            Bitmap n = Bitmap.createBitmap(bmp, 0, 0, bmp.getWidth(), bmp.getHeight(), m, true);
            if (n != bmp) bmp.recycle();
            return n;
        } catch (Exception e) {
            return bmp;
        }
    }

    private void resolve(PluginCall call, JSObject ret) {
        Activity activity = getActivity();
        if (activity == null) {
            call.resolve(ret);
            return;
        }
        activity.runOnUiThread(() -> call.resolve(ret));
    }

    private void reject(PluginCall call, String message) {
        Activity activity = getActivity();
        if (activity == null) {
            call.reject(message);
            return;
        }
        activity.runOnUiThread(() -> call.reject(message));
    }
}
