# Ruta Cero — MVP de asistentes

Esta rama añade un módulo independiente a la plataforma Systeam existente. No cambia el diagnóstico actual ni activa estudiantes automáticamente.

## Incluido

- Ruta protegida: `/ruta-cero`, accesible después de iniciar sesión.
- Ocho asistentes identificados según la **guía actualizada de seis semanas**. Únicamente **Cerebro de Mercado** tiene un motor conversacional funcional.
- Conversaciones de Cerebro de Mercado guardadas por UID del estudiante en Firestore.
- Workbook básico con `fortalezas`, `puntoCero` y `anguloOportunidad`.
- API de acceso por token de Firebase y verificación de inscripción activa.
- Herramienta básica de activación por correo para administradores, disponible desde Ruta Cero.

## Modelo de datos (backend Firebase Admin, sin escrituras cliente)

- `rutaCeroEnrollments/{uid}`: `active`, `program`, `email`, `activatedBy`, `updatedAt`.
- `rutaCeroWorkbooks/{uid}`: `fields`, `updatedAt`.
- `rutaCeroConversations/{uid}/agents/cerebro-mercado`: `messages`, `updatedAt`.

Las colecciones nuevas **no se añaden a las reglas públicas de Firestore** y están denegadas por la regla catch-all existente. Solamente el servidor, previa autenticación y validación de inscripción, accede a ellas usando Firebase Admin SDK.

## Configuración del servidor

Se reutilizan `GEMINI_API_KEY`, `FIREBASE_SERVICE_ACCOUNT_JSON` y `firebase-applet-config.json` de la aplicación actual. Opcionalmente, `RUTA_CERO_GEMINI_MODEL` permite cambiar el modelo; el valor inicial es `gemini-2.5-flash`.

Nunca almacenes claves en el frontend ni en el repositorio.

## Antes de publicar para estudiantes

1. Ejecutar `npm install`, `npm run lint` y `npm run build` en el entorno de la aplicación.
2. Confirmar que `FIREBASE_SERVICE_ACCOUNT_JSON` tiene acceso a la base `firestoreDatabaseId` existente.
3. Iniciar sesión con cuenta administradora, abrir `/ruta-cero` y activar un correo que **ya esté registrado** en Systeam.
4. Iniciar sesión como estudiante activado: guardar y recargar Workbook; conversar con Cerebro de Mercado; cerrar y abrir sesión y comprobar persistencia.
5. Comprobar acceso denegado con una cuenta no inscrita y bloqueo de endpoints sin token.
6. Confirmar que los contenidos anteriores de diagnóstico y clases no se modificaron.
7. Revisar coste, límites de uso, política de datos y capacidad antes de habilitar la primera cohorte.
8. No atribuirle búsqueda web a Cerebro de Mercado. En el MVP entrega solamente orientación general; la búsqueda verificable queda para una iteración posterior.

## Próxima iteración

- Workbook estructurado para las ocho entradas/salidas de agentes.
- Control de desbloqueo por semana/día y comprobación de finalización del ejercicio.
- Cerebro de Mercado con herramienta de búsqueda web y citas de fuentes verificables.
- Panel de progreso para mentoría, integración de compras Hotmart/GHL y activación automática únicamente por compra validada.
- Política de retención de conversaciones, exportación y borrado por estudiante.

**Alcance**: implementación inicial para revisión; no se declara lista para producción hasta superar pruebas y despliegue.

## Seguridad identificada durante validación

La revisión encontró una antigua vía de alta administrativa que contenía una contraseña fija en código público. Se eliminó en esta rama, pero **el propietario de Firebase debe rotar la contraseña** de la cuenta afectada y revisar cuentas privilegiadas ya creadas. No se han cambiado credenciales reales.

Se restringió la creación de perfiles en `firestore.rules` para impedir que un usuario se autoasigne roles privilegiados, y se exigió correo verificado para operaciones administrativas de servidor y frontend.

**La modificación de `firestore.rules` no entra en vigor automáticamente al actualizar la aplicación web.** Antes de dar acceso a estudiantes, desplegar y verificar las reglas sobre la base Firestore concreta identificada en `firebase-applet-config.json`, y revisar los roles actuales de los perfiles existentes.

La auditoría de dependencias encontró alertas previas (incluidas críticas); se intentan correcciones compatibles del lockfile en la rama, y cualquier alerta residual debe revisarse antes de publicación.
