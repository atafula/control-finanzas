# Control de finanzas

> Apunta tus gastos e ingresos en segundos. Sin suscripciones, sin rastreos, sin complicaciones.

**Ábrela:** [atafula.github.io/control-finanzas](https://atafula.github.io/control-finanzas/)

## Características

- **Ingresos y gastos**: balance del mes, con y sin gastos extraordinarios
- **Gastos e ingresos fijos**: marca «Cada mes» y se apuntan solos cada mes (se quitan en Ajustes)
- **Extraordinarios**: compras puntuales que no cuentan en la media diaria
- **Teclado propio y categoría sugerida**: apuntar un gasto son tres toques
- **Gráfico diario y mensual**: en qué días (o meses) se va el dinero
- **Movimientos**: todo el mes agrupado por días, con filtros (gastos, ingresos, fijos) y búsqueda
- **Offline-first**: funciona sin conexión y sincroniza cuando hay red
- **Instantáneo**: carga desde el móvil sin esperar a internet
- **Sincronización en la nube**: opcional con Google, tus datos siempre a salvo
- **Sin registro obligatorio**: úsala sin cuenta y sincroniza cuando quieras
- **PWA instalable**: ponla en la pantalla de inicio como una app nativa
- **Modo oscuro**: automático o elegido en Ajustes
- **Búsqueda inteligente**: ignora tildes y mayúsculas
- **Resumen mensual y anual**: ve en qué te gastas el dinero
- **Exportar a CSV / JSON**: llévate tus datos donde quieras

---

## Instalación en el móvil

### iPhone (iOS)
1. Abre la app en **Safari**
2. Pulsa el botón compartir ↑
3. **Añadir a pantalla de inicio**

### Android
1. Abre la app en **Chrome**
2. Tres puntos ⋮ → **Añadir a pantalla de inicio**

---

## Sincronización con Google (opcional)

Los datos se guardan siempre en tu móvil. Si quieres tenerlos también en la nube:

1. Abre **Ajustes** (el botón ⚙ de arriba a la derecha)
2. En **Cuenta**, pulsa **Sincronizar con Google** y elige tu cuenta
3. Listo: tus gastos, ingresos, categorías y fijos se sincronizan solos

> Lo que apuntes sin conexión se sube solo al volver a tener red.

---

## Publicar tu propia versión

1. Haz fork de este repositorio
2. Ve a **Settings → Pages → Branch: main → / (root) → Save**
3. En unos minutos estará en `https://TU-USUARIO.github.io/control-finanzas/`

Para usar tu propio Firebase:

1. Cambia `FIREBASE_CONFIG` en `app.js` por la configuración de tu proyecto
2. Copia `firestore.rules` en Firebase → **Firestore → Reglas → Publicar**
3. Activa el inicio de sesión con Google en **Authentication → Sign-in method**
4. Añade `TU-USUARIO.github.io` en **Authentication → Settings → Dominios autorizados**

---

## Desarrollo local

```bash
cd control-finanzas
python -m http.server 8000
# Abre http://localhost:8000/
```

---

## Tests

Con el servidor local de arriba, abre `http://localhost:8000/test.html`.

Prueba las funciones de `utils.js` y la app completa con un Firebase simulado, sin tocar tus datos reales:
añadir, editar y borrar, ingresos, extraordinarios, fijos, teclado, categorías, búsqueda, resumen del año,
copias de seguridad, sesión y uso sin conexión.

---

## Estructura

```
control-finanzas/
├── index.html       # Estructura de la app
├── app.js           # Pantalla: gastos, ingresos, fijos, categorías, sync, auth
├── utils.js         # Funciones puras (las prueba test.html)
├── icons.js         # Iconos (Lucide, licencia ISC)
├── style.css        # Diseño y temas claro/oscuro
├── firestore.rules  # Reglas de Firestore (cópialas en la consola de Firebase)
├── sw.js            # Service Worker (offline + caché)
├── manifest.json    # Configuración PWA
├── fonts/           # Fuente autoalojada (Geist, licencia OFL)
├── icon-*.png/.svg  # Iconos de la app
├── logo.svg         # Logo original editable
└── test.html        # Tests de las funciones y de la app completa
```

---

## Personalización

**Categorías de gasto:** se editan desde la propia app (**Por categoría → Editar**). Las de serie están en `DEFAULT_CATS`, en `utils.js`.

**Categorías de ingreso:** edita `INCOME_CATS` en `utils.js`.

**Colores:** cada categoría lleva un color (`--c0`…`--c10` para gastos e `--i0`…`--i4` para ingresos, en `style.css`).

**Después de cambiar archivos:** sube la versión del caché en `sw.js` (`mis-gastos-v24`, `v25`…) para que los móviles cojan los cambios.

---

## Licencia

[PolyForm Noncommercial 1.0.0](LICENSE): puedes usarla, modificarla y compartirla gratis, pero no venderla ni usarla con fines comerciales.

### Componentes de terceros

- Fuente [Geist](https://github.com/vercel/geist-font), © Vercel, licencia SIL OFL 1.1 (`fonts/Geist-OFL.txt`)
- Iconos [Lucide](https://lucide.dev), © Lucide Contributors, licencia ISC
