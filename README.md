# MotoVerse Android

Aplicação Android MotoVerse — plataforma para motociclistas.

## APK
O GitHub Actions compila automaticamente o APK em cada push para `main`.
Abra **Actions > Build MotoVerse APK > Artifacts > MotoVerse-APK** para descarregar.

MotoVerse pertence ao grupo **AUTOfamily Lda** — geral@motoverse.pt

## Diretório, comunidade e alertas — Android 1.13

O diretório é distribuído no APK, em `app/src/main/assets/directory-data.js`. Inclui factos
comerciais com fonte por ficha e moradas aproximadas quando indicado. Dados
© [contribuidores OpenStreetMap](https://www.openstreetmap.org/copyright) (ODbL).
Localidades de [GeoNames](https://www.geonames.org/) (CC BY 4.0). Os dados de
venda, contactos e redes oficiais devem ser atualizados a partir das fontes das fichas.

A publicação usa a coleção Firestore `meetups`. As preferências de notificação são
guardadas no dispositivo por conta. A app usa um listener em primeiro plano e
WorkManager em segundo plano. Para enviar também através do FCM logo após a publicação,
implanta a função no projeto Firebase usado pelo APK. Requer acesso de implantação e
o plano Blaze. Testa com dois utilizadores que não sejam o mesmo organizador.

```sh
firebase deploy --only functions:notifyCommunityInterests --project motoverse-c4d23
```

A consulta de avaliações em cada ficha usa a Places API (New). Configura a chave
restrita a esta API, com faturação e quotas no Google Cloud, no Secret Manager do projeto.
A chave nunca é incorporada no APK. Assinala os custos e verifica os [requisitos de
atribuição do Google Maps](https://developers.google.com/maps/documentation/places/web-service/policies)
antes de ativar a consulta. O botão das avaliações no Maps funciona sem esta configuração.

```sh
firebase functions:secrets:set MOTOVERSE_PLACES_API_KEY --project motoverse-c4d23
firebase deploy --only functions:directoryGoogleRating --project motoverse-c4d23
```
