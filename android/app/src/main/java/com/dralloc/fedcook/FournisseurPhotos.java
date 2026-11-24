package com.dralloc.fedcook;

import android.content.ContentProvider;
import android.content.ContentValues;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;

import java.io.File;
import java.io.FileNotFoundException;

/**
 * Donne à l'appareil photo un fichier où écrire la photo (dans le cache de FedCook),
 * puis permet à la page de la relire. Rien ne va dans la galerie du téléphone.
 */
public class FournisseurPhotos extends ContentProvider {

    @Override
    public boolean onCreate() {
        return true;
    }

    private File fichier(Uri adresse) throws FileNotFoundException {
        String nom = adresse.getLastPathSegment();
        if (nom == null || !nom.matches("photo-[0-9]+\\.jpg") || getContext() == null) {
            throw new FileNotFoundException("Photo inconnue");
        }
        return new File(new File(getContext().getCacheDir(), "photos"), nom);
    }

    @Override
    public ParcelFileDescriptor openFile(Uri adresse, String mode) throws FileNotFoundException {
        return ParcelFileDescriptor.open(fichier(adresse), ParcelFileDescriptor.parseMode(mode));
    }

    @Override
    public String getType(Uri adresse) {
        return "image/jpeg";
    }

    @Override
    public Cursor query(Uri adresse, String[] colonnes, String selection, String[] arguments, String tri) {
        File f;
        try {
            f = fichier(adresse);
        } catch (FileNotFoundException e) {
            return null;
        }
        MatrixCursor curseur = new MatrixCursor(new String[]{OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE});
        curseur.addRow(new Object[]{f.getName(), f.length()});
        return curseur;
    }

    @Override
    public Uri insert(Uri adresse, ContentValues valeurs) {
        return null;
    }

    @Override
    public int delete(Uri adresse, String selection, String[] arguments) {
        return 0;
    }

    @Override
    public int update(Uri adresse, ContentValues valeurs, String selection, String[] arguments) {
        return 0;
    }
}
