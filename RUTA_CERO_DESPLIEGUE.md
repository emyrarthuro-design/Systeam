# Publicación controlada — Ruta Cero Systeam

> No desplegar automáticamente a producción al aprobar esta solicitud de revisión. El MVP ha superado comprobaciones de código y API simulada, pero **no** se han realizado pruebas contra Firebase / Gemini reales.

## Estado comprobado (6 noviembre 2026)

- TypeScript y compilación de producción: aprobados por GitHub Actions.
- Pruebas automatizadas de autenticación, inscripción, Workbook, conversaciones por modo y permisos: verificadas en una API simulada. El número exacto de pruebas se consulta en GitHub Actions.
- `npm audit --omit=dev --audit-level=critical`: pasa después de aplicar correcciones compatibles al lockfile. Quedan alertas de severidad alta y moderada por estudiar.
- El estudiante puede guardar explícitamente su Ángulo de Oportunidad desde Cerebro de Mercado, su contenido desde Agente de Contenido y ambas ofertas desde Constructor de Oferta. Las conversaciones de los tres modos de contenido están separadas.
- Constructor de Oferta se guarda con API de validación propia: primera venta $7–27, experiencia $27–100 y Siguiente Nivel 3–10 veces el Low Ticket. No admite guardar una oferta sin revisar precio, nombre, formato, entregables y transformación.
- Ninguno de los tres agentes **dispone todavía de búsqueda web**. Las referencias de mercado se presentan como orientativas. No están implantados los desbloqueos académicos por semana.

## Bloqueadores previos a producción

1. **Rotar credenciales expuestas**: la versión anterior del login tenía una contraseña administrativa fija en un repositorio público. Eliminarla del código NO la invalida. Cambiarla en Firebase Auth y revisar cuentas y permisos administrativos existentes.
2. **Verificar correos administrativos**: las reglas nuevas y el servidor exigen correo verificado. Verificar en Firebase Auth que los administradores actuales cumplan la condición antes del cambio.
3. **Revisar alertas altas de dependencias** (`npm audit` en GitHub Actions) y determinar si son explotables en el uso de producción. El audit sin críticas no significa cero riesgos.
4. **Publicar reglas Firestore correctas**: el archivo `firestore.rules` de esta rama es una modificación local del repositorio. Hay que publicarlo sobre la base Firestore con ID `ai-studio-72d878d4-8cd3-4326-8b27-466f5dbb4649` del proyecto Firebase identificado en `firebase-applet-config.json`. **No asumir que actualizar la aplicación publica las reglas.** Confirmar en la consola de Firebase la base seleccionada, comparar políticas y hacer prueba de acceso negado a usuarios normales.
5. Confirmar `FIREBASE_SERVICE_ACCOUNT_JSON` y `GEMINI_API_KEY` configurados como secretos del servidor, nunca en la aplicación web ni en Git.
6. Hacer copia o punto de recuperación de la configuración antes de desplegar.

## Secuencia técnica recomendada

1. Revisar los cambios propuestos en PR #7, incluyendo las reglas de Firestore y el login.
2. En entorno de ensayo, publicar el código del backend y frontend usando el mecanismo habitual de Google AI Studio / Cloud Run indicado por la aplicación. El repositorio no contiene workflow de despliegue Cloud Run listo y no existe acceso de despliegue en esta ejecución.
3. Verificar `/ruta-cero` al iniciar sesión como admin verificado.
4. En el portal, activar una cuenta de prueba cuyo correo ya exista en `users`. No usar correos de estudiantes reales durante los ensayos.
5. Entrar como estudiante autorizado, guardar fortalezas y Punto Cero en Workbook, recargar y verificar persistencia.
6. Enviar dos mensajes a Cerebro de Mercado y comprobar que el segundo conserva el contexto.
6a. Entrar a Agente de Contenido; comprobar los modos Pilares, Publicaciones y Sistema 90 días. Verificar que cada conversación sea independiente y que el Workbook sí comparta Avatar, Pilares, Bio y Oferta.
6b. Guardar resultados del agente explícitamente, recargar y verificar que sobreviven a un nuevo inicio de sesión. Probar bio de más de 150 caracteres (debe rechazarse).
6c. En Constructor de Oferta: guardar Avatar y Ángulo de Oportunidad, probar primera venta a $6.99 (rechazado), $7 y $27 (aceptados); experiencia previa a $26.99 (rechazado), $27 y $100 (aceptados); comprobar que Siguiente Nivel no se guarda antes y que solo acepta 3–10 veces el precio del Low Ticket guardado. Cambiar el Low Ticket y confirmar que invalida el Siguiente Nivel anterior.
7. Elegir explícitamente "Guardar este Ángulo en mi Workbook", recargar y comprobar persistencia.
8. Probar acceso con otra cuenta inscrita y verificar que no pueda ver ni modificar el Workbook de la anterior.
9. Entrar con una cuenta no inscrita: debe recibir denegación de acceso. Probar además token ausente y email admin no verificado.
10. Verificar que las rutas de diagnóstico, clases y administradores ya existentes siguen funcionando; especialmente creación de alumno con rol `student`.
11. Confirmar métricas de llamadas a Gemini, errores y presupuesto del primer grupo.
12. Sólo después de completar estas pruebas, desplegar a producción y activar las cuentas de estudiantes autorizadas.

## Acceso

- Ruta de interfaz: `/ruta-cero`
- API: `/api/ruta-cero/state`, `/api/ruta-cero/workbook`, `/api/ruta-cero/chat`, `/api/ruta-cero/admin/enroll`.
- Los datos académicos residen en `rutaCeroWorkbooks`, `rutaCeroConversations` y `rutaCeroEnrollments`, consultados por Firebase Admin SDK. Las reglas niegan acceso directo desde el navegador a esas colecciones.

## Rollback

Revertir publicación de frontend/backend si hay errores; revisar por separado que las reglas Firestore coincidan con la política aprobada. No borrar `rutaCeroWorkbooks` ni `rutaCeroConversations` al revertir: contienen entregables académicos de estudiantes.

## Siguientes mejoras

Integración con compras Hotmart/GHL, desbloqueos por lección, diagnósticos Ruta Cero, panel de mentor y agentes 4–8 de la guía de seis semanas. Los tres primeros agentes están implementados en la rama, pendientes de prueba real con los servicios y aprobación académica antes de activar estudiantes.
