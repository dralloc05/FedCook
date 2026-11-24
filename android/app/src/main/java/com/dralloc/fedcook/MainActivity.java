package com.dralloc.fedcook;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.ClipData;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ResolveInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.provider.MediaStore;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.File;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/**
 * FedCook pour Android : une fenêtre qui affiche l'appli web publiée sur GitHub Pages.
 * L'appli se met donc à jour toute seule quand le site change, sans nouvel APK.
 *
 * En plus de la page, cette activité gère ce qu'une WebView ne fait pas seule :
 * la caméra pour le scan des codes-barres, les photos (ticket, frigo),
 * le choix d'un fichier (restauration), l'enregistrement d'une sauvegarde,
 * et le bouton retour du téléphone.
 */
public class MainActivity extends Activity {

    private static final String ADRESSE = "https://dralloc05.github.io/FedCook/";
    private static final String HOTE = "dralloc05.github.io";
    private static final String AUTORITE_PHOTOS = "com.dralloc.fedcook.photos";

    private static final int DEMANDE_CAMERA_SCAN = 1;
    private static final int DEMANDE_CAMERA_PHOTO = 2;
    private static final int CHOIX_FICHIER = 3;

    private static final String PAGE_HORS_LIGNE =
            "<html><head><meta name='viewport' content='width=device-width,initial-scale=1'>"
            + "<style>body{font-family:sans-serif;background:#F6F6F3;color:#17181A;display:flex;"
            + "flex-direction:column;align-items:center;justify-content:center;height:90vh;text-align:center;padding:24px}"
            + "button{background:#1E7A4C;color:#fff;border:0;border-radius:24px;padding:14px 28px;font-size:16px;font-weight:600}"
            + "</style></head><body><h2>Pas de connexion</h2>"
            + "<p>Au premier lancement, FedCook a besoin d'Internet pour se charger.<br>Ensuite, elle marche aussi hors ligne.</p>"
            + "<button onclick='FedCookAndroid.recharger()'>Réessayer</button></body></html>";

    private WebView vue;
    private PermissionRequest demandeScanEnAttente;
    private ValueCallback<Uri[]> rappelFichier;
    private WebChromeClient.FileChooserParams parametresFichier;
    private Uri photoPrise;

    @Override
    protected void onCreate(Bundle etatSauve) {
        super.onCreate(etatSauve);
        nettoyerVieillesPhotos();

        vue = new WebView(this);
        vue.setBackgroundColor(Color.parseColor("#F6F6F3"));
        setContentView(vue);

        WebSettings reglages = vue.getSettings();
        reglages.setJavaScriptEnabled(true);
        reglages.setDomStorageEnabled(true);
        reglages.setMediaPlaybackRequiresUserGesture(false);
        reglages.setAllowFileAccess(false);
        reglages.setAllowContentAccess(true);
        vue.addJavascriptInterface(new Pont(), "FedCookAndroid");

        vue.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest demande) {
                Uri adresse = demande.getUrl();
                if (HOTE.equalsIgnoreCase(adresse.getHost())) {
                    return false;
                }
                // Liens externes (Google AI Studio, etc.) : dans le navigateur du téléphone.
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, adresse));
                } catch (ActivityNotFoundException e) {
                    Toast.makeText(MainActivity.this, "Aucune appli pour ouvrir ce lien", Toast.LENGTH_SHORT).show();
                }
                return true;
            }

            @Override
            public void onReceivedError(WebView v, WebResourceRequest demande, WebResourceError erreur) {
                if (demande.isForMainFrame()) {
                    v.loadDataWithBaseURL(null, PAGE_HORS_LIGNE, "text/html", "utf-8", null);
                }
            }
        });

        vue.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest demande) {
                runOnUiThread(() -> autoriserCamera(demande));
            }

            @Override
            public boolean onShowFileChooser(WebView v, ValueCallback<Uri[]> rappel, FileChooserParams parametres) {
                if (rappelFichier != null) {
                    rappelFichier.onReceiveValue(null);
                }
                rappelFichier = rappel;
                parametresFichier = parametres;
                if (veutPhoto(parametres) && !cameraAutorisee()) {
                    requestPermissions(new String[]{Manifest.permission.CAMERA}, DEMANDE_CAMERA_PHOTO);
                } else {
                    ouvrirSelecteur();
                }
                return true;
            }
        });

        if (etatSauve != null) {
            vue.restoreState(etatSauve);
        } else {
            vue.loadUrl(ADRESSE);
        }
    }

    // ---------- Caméra pour le scan des codes-barres (getUserMedia) ----------

    private void autoriserCamera(PermissionRequest demande) {
        boolean video = false;
        for (String ressource : demande.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(ressource)) {
                video = true;
            }
        }
        if (!video) {
            demande.deny();
            return;
        }
        if (cameraAutorisee()) {
            demande.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            if (demandeScanEnAttente != null) {
                demandeScanEnAttente.deny();
            }
            demandeScanEnAttente = demande;
            requestPermissions(new String[]{Manifest.permission.CAMERA}, DEMANDE_CAMERA_SCAN);
        }
    }

    private boolean cameraAutorisee() {
        return checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED;
    }

    @Override
    public void onRequestPermissionsResult(int code, String[] permissions, int[] resultats) {
        boolean accorde = resultats.length > 0 && resultats[0] == PackageManager.PERMISSION_GRANTED;
        if (code == DEMANDE_CAMERA_SCAN && demandeScanEnAttente != null) {
            if (accorde) {
                demandeScanEnAttente.grant(new String[]{PermissionRequest.RESOURCE_VIDEO_CAPTURE});
            } else {
                demandeScanEnAttente.deny();
            }
            demandeScanEnAttente = null;
        } else if (code == DEMANDE_CAMERA_PHOTO && rappelFichier != null) {
            // Refusé : on ouvre quand même la galerie.
            ouvrirSelecteur();
        }
    }

    // ---------- Photos (ticket, frigo) et choix de fichier (restauration) ----------

    private boolean veutPhoto(WebChromeClient.FileChooserParams parametres) {
        return parametres != null && parametres.isCaptureEnabled() && accepteImages(parametres);
    }

    private boolean accepteImages(WebChromeClient.FileChooserParams parametres) {
        String[] types = parametres.getAcceptTypes();
        if (types == null || types.length == 0) {
            return true;
        }
        for (String type : types) {
            if (type == null || type.isEmpty() || type.startsWith("image")) {
                return true;
            }
        }
        return false;
    }

    private void ouvrirSelecteur() {
        WebChromeClient.FileChooserParams parametres = parametresFichier;
        photoPrise = null;
        Intent aLancer = null;

        if (veutPhoto(parametres) && cameraAutorisee()) {
            aLancer = intentionPhoto();
        }
        if (aLancer == null && parametres != null) {
            if (accepteImages(parametres)) {
                aLancer = parametres.createIntent();
            } else {
                // Sauvegarde .json : certains gestionnaires de fichiers grisent les .json
                // si on filtre par type, donc on montre tout (l'appli vérifie le contenu).
                aLancer = new Intent(Intent.ACTION_GET_CONTENT);
                aLancer.addCategory(Intent.CATEGORY_OPENABLE);
                aLancer.setType("*/*");
            }
        }
        if (aLancer == null) {
            terminerChoix(null);
            return;
        }
        try {
            startActivityForResult(aLancer, CHOIX_FICHIER);
        } catch (ActivityNotFoundException e) {
            Toast.makeText(this, "Aucune appli disponible pour ça", Toast.LENGTH_SHORT).show();
            terminerChoix(null);
        }
    }

    /** Ouvre l'appareil photo ; la photo est écrite dans le cache de l'appli (voir FournisseurPhotos). */
    private Intent intentionPhoto() {
        File dossier = new File(getCacheDir(), "photos");
        if (!dossier.exists() && !dossier.mkdirs()) {
            return null;
        }
        String nom = "photo-" + System.currentTimeMillis() + ".jpg";
        photoPrise = Uri.parse("content://" + AUTORITE_PHOTOS + "/" + nom);

        Intent photo = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
        photo.putExtra(MediaStore.EXTRA_OUTPUT, photoPrise);
        photo.setClipData(ClipData.newRawUri("photo", photoPrise));
        int droits = Intent.FLAG_GRANT_WRITE_URI_PERMISSION | Intent.FLAG_GRANT_READ_URI_PERMISSION;
        photo.addFlags(droits);
        List<ResolveInfo> appareils = getPackageManager().queryIntentActivities(photo, PackageManager.MATCH_DEFAULT_ONLY);
        if (appareils.isEmpty()) {
            photoPrise = null;
            return null;
        }
        for (ResolveInfo appareil : appareils) {
            grantUriPermission(appareil.activityInfo.packageName, photoPrise, droits);
        }
        return photo;
    }

    @Override
    protected void onActivityResult(int code, int resultat, Intent donnees) {
        if (code != CHOIX_FICHIER) {
            super.onActivityResult(code, resultat, donnees);
            return;
        }
        Uri[] choix = null;
        if (resultat == RESULT_OK) {
            if (photoPrise != null) {
                File fichier = new File(new File(getCacheDir(), "photos"), photoPrise.getLastPathSegment());
                if (fichier.length() > 0) {
                    choix = new Uri[]{photoPrise};
                }
            } else {
                choix = WebChromeClient.FileChooserParams.parseResult(resultat, donnees);
            }
        }
        terminerChoix(choix);
    }

    private void terminerChoix(Uri[] choix) {
        if (rappelFichier != null) {
            rappelFichier.onReceiveValue(choix);
        }
        rappelFichier = null;
        parametresFichier = null;
        photoPrise = null;
    }

    /** Les photos ne servent qu'au moment de la lecture : on efface celles de plus de 2 jours. */
    private void nettoyerVieillesPhotos() {
        File[] fichiers = new File(getCacheDir(), "photos").listFiles();
        if (fichiers == null) {
            return;
        }
        long limite = System.currentTimeMillis() - 2L * 24 * 3600 * 1000;
        for (File f : fichiers) {
            if (f.lastModified() < limite) {
                //noinspection ResultOfMethodCallIgnored
                f.delete();
            }
        }
    }

    // ---------- Pont JavaScript : sauvegarde et rechargement ----------

    private class Pont {
        /** Appelé par l'écran Réglages : enregistre la sauvegarde dans Téléchargements/FedCook. */
        @JavascriptInterface
        public boolean enregistrer(String nom, String contenu) {
            try {
                ContentValues infos = new ContentValues();
                infos.put(MediaStore.MediaColumns.DISPLAY_NAME, nom);
                infos.put(MediaStore.MediaColumns.MIME_TYPE, "application/json");
                infos.put(MediaStore.MediaColumns.RELATIVE_PATH, "Download/FedCook");
                Uri fichier = getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, infos);
                if (fichier == null) {
                    return false;
                }
                try (OutputStream sortie = getContentResolver().openOutputStream(fichier)) {
                    if (sortie == null) {
                        return false;
                    }
                    sortie.write(contenu.getBytes(StandardCharsets.UTF_8));
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        @JavascriptInterface
        public void recharger() {
            vue.post(() -> vue.loadUrl(ADRESSE));
        }
    }

    // ---------- Cycle de vie et bouton retour ----------

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        if (vue != null && vue.canGoBack()) {
            vue.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle etat) {
        super.onSaveInstanceState(etat);
        vue.saveState(etat);
    }

    @Override
    protected void onPause() {
        super.onPause();
        vue.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        vue.onResume();
    }

    @Override
    protected void onDestroy() {
        if (demandeScanEnAttente != null) {
            demandeScanEnAttente.deny();
            demandeScanEnAttente = null;
        }
        terminerChoix(null);
        vue.destroy();
        super.onDestroy();
    }
}
