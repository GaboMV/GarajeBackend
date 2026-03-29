const prisma = require('../db/prisma');
const { uploadFilePublic, uploadFilePrivate, deleteFilePublic, deleteFilePrivate, getDynamicPresignedUrl } = require('../services/upload.service');
const logger = require('../utils/logger');

/**
 * Registra un nuevo inmueble (Garaje) en el sistema.
 * El garaje se crea en estado pendiente de aprobación administrativa.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const createGaraje = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const {
            nombre, descripcion, direccion,
            latitud, longitud, precio_hora, precio_dia,
            minimo_horas, tiempo_limpieza,
            tiene_wifi, tiene_bano, tiene_electricidad, tiene_mesa,
            servicios_extra,
            hora_inicio_jornada, hora_fin_jornada
        } = req.body;

        const lat = latitud || req.body.lat;
        const lng = longitud || req.body.lng;

        if (!nombre || (!precio_hora && !precio_dia)) {
            logger.warn('GarageController', 'Intento de creación con parámetros obligatorios incompletos', { id_dueno });
            return res.status(400).json({ error: 'Nombre e indicador de precio son parámetros mandatorios.' });
        }

        let documentoPropiedadUrl = null;
        if (req.files && req.files['documento'] && req.files['documento'].length > 0) {
            documentoPropiedadUrl = await uploadFilePrivate(req.files['documento'][0], 'garajes-docs');
            logger.info('GarageController', 'Documento de integridad jurídica almacenado y firmado.', { key: documentoPropiedadUrl });
        } else {
            logger.warn('GarageController', 'Carencia de documentación de propiedad en el envío multiparte.');
        }

        const garajePendiente = await prisma.garaje.findFirst({
            where: {
                id_dueno,
                esta_aprobado: false
            }
        });

        if (garajePendiente) {
            logger.warn('GarageController', 'Política antifraude: Rechazado por contar con una solicitud activa ya encolada.', { id_dueno });
            return res.status(400).json({ 
                error: 'Restricción de duplicidad parcial.',
                message: 'No está permitido inscribir nuevas facilidades hasta emitir resolución para la gestión en curso.'
            });
        }

        const nuevoGaraje = await prisma.garaje.create({
            data: {
                id_dueno,
                nombre,
                descripcion,
                direccion,
                latitud: (lat !== undefined && lat !== null && lat !== '') ? parseFloat(lat) : null,
                longitud: (lng !== undefined && lng !== null && lng !== '') ? parseFloat(lng) : null,
                precio_hora: precio_hora ? parseFloat(precio_hora) : null,
                precio_dia: precio_dia ? parseFloat(precio_dia) : null,
                minimo_horas: minimo_horas ? parseInt(minimo_horas) : 1,
                tiempo_limpieza: tiempo_limpieza ? parseInt(tiempo_limpieza) : 0,
                tiene_wifi: tiene_wifi === 'true' || tiene_wifi === true,
                tiene_bano: tiene_bano === 'true' || tiene_bano === true,
                tiene_electricidad: tiene_electricidad === 'true' || tiene_electricidad === true,
                tiene_mesa: tiene_mesa === 'true' || tiene_mesa === true,
                esta_aprobado: false,
                documento_propiedad_url: documentoPropiedadUrl,
                hora_inicio_jornada: hora_inicio_jornada || "08:00",
                hora_fin_jornada: hora_fin_jornada || "20:00",
            }
        });

        const usuarioActualizado = await prisma.usuario.update({
            where: { id: id_dueno },
            data: { modo_actual: 'PROPIETARIO' }
        });

        if (req.files && req.files['imagenes']) {
            const uploadPromises = req.files['imagenes'].map(file => uploadFilePublic(file, 'garajes'));
            const uploadedImageUrls = await Promise.all(uploadPromises);
            
            if (uploadedImageUrls.length > 0) {
                const imagenesData = uploadedImageUrls.map(url => ({
                    id_garaje: nuevoGaraje.id,
                    url
                }));

                await prisma.imagenGaraje.createMany({
                    data: imagenesData
                });
            }
        }

        if (lat !== undefined && lat !== null && lat !== '' && 
            lng !== undefined && lng !== null && lng !== '') {
            await prisma.$executeRaw`
                UPDATE "Garaje" 
                SET ubicacion_geo = ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326) 
                WHERE id = ${nuevoGaraje.id}
            `;
            logger.info('GarageController', `PostGIS actualizado mediante proyecciones estandarizadas 4326.`, { garaje_id: nuevoGaraje.id });
        }

        if (servicios_extra && typeof servicios_extra === 'string') {
            const serviciosArray = servicios_extra.split(',').map(s => {
                const parts = s.split(':');
                return {
                    id_garaje: nuevoGaraje.id,
                    nombre: parts[0],
                    precio: parseFloat(parts[1] || '0')
                };
            });

            if (serviciosArray.length > 0) {
                await prisma.servicioAdicional.createMany({
                    data: serviciosArray
                });
            }
        }

        logger.info('GarageController', `Nueva estructura de alquiler configurada exitosamente`, { garaje_id: nuevoGaraje.id });

        res.status(201).json({
            message: 'Inmueble listado de manera exitosa en el pipeline de evaluación',
            garaje: nuevoGaraje,
            user: {
                id: usuarioActualizado.id,
                nombre_completo: usuarioActualizado.nombre_completo,
                esta_verificado: usuarioActualizado.esta_verificado,
                modo_actual: usuarioActualizado.modo_actual
            }
        });
    } catch (error) {
        logger.error('GarageController', 'Excepción crítica no controlada al tratar de instanciar un inmueble.', error);
        next(error);
    }
};

/**
 * Adiciona esquemas de apertura o bandas horarias al establecimiento.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const addHorario = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const { dia_semana, abierto, hora_inicio, hora_fin } = req.body;

        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Autorización delegada insuficiente sobre el inmueble actual.' });
        }

        const horario = await prisma.horarioSemanal.create({
            data: {
                id_garaje: idGaraje,
                dia_semana,
                abierto: abierto !== undefined ? abierto : true,
                hora_inicio: hora_inicio || "08:00",
                hora_fin: hora_fin || "20:00"
            }
        });

        logger.info('GarageController', `Banda de horario fijada sistemáticamente: Día índice ${dia_semana}`);

        res.status(201).json({
            message: 'Segmentación horaria insertada apropiadamente',
            horario
        });
    } catch (error) {
        logger.error('GarageController', 'Error al ejecutar inyección paramétrica de cronogramas semanales.', error);
        next(error);
    }
};

/**
 * Registra parámetros auxiliares (servicios suplementarios).
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const addServicioAdicional = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const { nombre, precio, es_por_dia } = req.body;

        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Acreditación técnica delegada insuficiente.' });
        }

        const servicio = await prisma.servicioAdicional.create({
            data: {
                id_garaje: idGaraje,
                nombre,
                precio,
                es_por_dia: es_por_dia !== undefined ? es_por_dia : true,
            }
        });

        logger.info('GarageController', `Valor agregado introducido de forma unitaria ("${nombre}")`);

        res.status(201).json({
            message: 'El equipamiento logístico complementario ha sido incluido al repositorio estructural.',
            servicio
        });
    } catch (error) {
        logger.error('GarageController', 'Excepciones generizadas afectaron al subsistema de inserción suplementaria.', error);
        next(error);
    }
};

/**
 * Retira servicios complementarios previamente declarados.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const deleteServicioAdicional = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje, idServicio } = req.params;

        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'El dominio contractual previene interacciones por el origen actuante.' });
        }

        await prisma.servicioAdicional.delete({
            where: { id: idServicio }
        });

        logger.info('GarageController', `Subsanación de equipamiento secundario completada. ID de Servicio: ${idServicio}`);

        res.json({ message: 'Entidad dependiente revocada exitosamente' });
    } catch (error) {
        if (error.code === 'P2025') {
            return res.status(404).json({ error: 'La tupla descriptiva de servicio no existe.' });
        }
        logger.error('GarageController', 'Desbordamiento sistemático detectado en la limpieza dependiente', error);
        next(error);
    }
};

/**
 * Ejerce un veto operacional sobre el establecimiento por un rango calendario determinado.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const blockDate = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const { fecha, motivo } = req.body;

        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Validación contextual de alcance jerárquico reprobada.' });
        }

        const fechaBloqueada = await prisma.fechaBloqueada.create({
            data: {
                id_garaje: idGaraje,
                fecha: new Date(fecha),
                motivo
            }
        });

        logger.info('GarageController', `Declaración de inactividad operativa para ${fecha}. Inmueble ${idGaraje}`);

        res.status(201).json({
            message: 'La segmentación de espacio horario queda inutilizada en el dominio transaccional',
            fechaBloqueada
        });
    } catch (error) {
        logger.error('GarageController', 'Caída transaccional al definir clausura sistemática', error);
        next(error);
    }
}

/**
 * Admite repositorios iconográficos atados al activo inmobiliario principal.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const addImagen = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;

        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Negación de servicio - Identidad sin alcance jurídico local' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'La solicitud no contempla buffer válido sobre el objeto adjuntado' });
        }

        const url = await uploadFilePublic(req.file, 'garajes');

        const imagen = await prisma.imagenGaraje.create({
            data: {
                id_garaje: idGaraje,
                url
            }
        });

        logger.info('GarageController', `Integración gráfica de soporte adjuntada a R2 con referencia directa en BD para ${idGaraje}`);

        res.status(201).json({ imagen });
    } catch (error) {
        logger.error('GarageController', 'El adaptador criptográfico a R2 repelió por anomalía o latencia general de la red externa.', error);
        next(error);
    }
}

/**
 * Lista sistemática global de pertenencias adjudicadas explícitamente al perfil local.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getMyGarages = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const garajes = await prisma.garaje.findMany({
            where: { id_dueno },
            include: {
                imagenes: true,
                horarios_semanales: true,
                servicios_adicionales: true,
                fechas_bloqueadas: true,
            }
        });
        
        logger.info('GarageController', `Compilación matriz resuelta con éxito - Instancias locales obtenidas: ${garajes.length}`);
        
        res.json({ garajes });
    } catch (error) {
        logger.error('GarageController', 'Declinación por error anómalo durante interconsulta a PostgreSQL-Prisma Engine', error);
        next(error);
    }
}

/**
 * Identificación unívoca del expediente descriptivo del ente inmobilario de acuerdo a UUID asignado.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getGarageById = async (req, res, next) => {
    try {
        const { idGaraje } = req.params;
        const garaje = await prisma.garaje.findUnique({
            where: { id: idGaraje },
            include: {
                imagenes: true,
                horarios_semanales: true,
                servicios_adicionales: true,
                fechas_bloqueadas: true,
                dueno: {
                    select: {
                        nombre_completo: true,
                        url_foto_perfil: true
                    }
                }
            }
        });

        if (!garaje) {
            return res.status(404).json({ error: 'El registro persistente del id inquirido no está presente.' });
        }

        res.json({ garaje });
    } catch (error) {
        logger.error('GarageController', 'Perturbación operativa no especificada al localizar ID jerárquico', error);
        next(error);
    }
}

/**
 * Modificador escalar de los metadatos y representaciones del establecimiento.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const updateGarage = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;
        const {
            nombre, descripcion, direccion,
            latitud, longitud, precio_hora, precio_dia,
            minimo_horas, tiempo_limpieza, capacidad_puestos,
            tiene_wifi, tiene_bano, tiene_electricidad, tiene_mesa
        } = req.body;

        const garajeExistente = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garajeExistente || garajeExistente.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Capacidad administrativa o vinculación no provista sobre este objeto.' });
        }

        const garajeActualizado = await prisma.garaje.update({
            where: { id: idGaraje },
            data: {
                nombre: nombre !== undefined ? nombre : garajeExistente.nombre,
                descripcion: descripcion !== undefined ? descripcion : garajeExistente.descripcion,
                direccion: direccion !== undefined ? direccion : garajeExistente.direccion,
                latitud: latitud !== undefined ? latitud : garajeExistente.latitud,
                longitud: longitud !== undefined ? longitud : garajeExistente.longitud,
                precio_hora: precio_hora !== undefined ? precio_hora : garajeExistente.precio_hora,
                precio_dia: precio_dia !== undefined ? precio_dia : garajeExistente.precio_dia,
                minimo_horas: minimo_horas !== undefined ? minimo_horas : garajeExistente.minimo_horas,
                tiempo_limpieza: tiempo_limpieza !== undefined ? tiempo_limpieza : garajeExistente.tiempo_limpieza,
                capacidad_puestos: capacidad_puestos !== undefined ? capacidad_puestos : garajeExistente.capacidad_puestos,
                tiene_wifi: tiene_wifi !== undefined ? tiene_wifi : garajeExistente.tiene_wifi,
                tiene_bano: tiene_bano !== undefined ? tiene_bano : garajeExistente.tiene_bano,
                tiene_electricidad: tiene_electricidad !== undefined ? tiene_electricidad : garajeExistente.tiene_electricidad,
                tiene_mesa: tiene_mesa !== undefined ? tiene_mesa : garajeExistente.tiene_mesa,
            }
        });

        if (latitud !== undefined && longitud !== undefined) {
            await prisma.$executeRaw`
                UPDATE "Garaje" 
                SET ubicacion_geo = ST_SetSRID(ST_MakePoint(${parseFloat(longitud)}, ${parseFloat(latitud)}), 4326) 
                WHERE id = ${idGaraje}
            `;
            logger.info('GarageController', `Actualización trigonométrica espacial para Garaje: ${idGaraje}`);
        }

        logger.info('GarageController', `Atributos modulares actualizados exitosamente en dominio persistido.`, { idGaraje });

        res.json({ message: 'Convalidación del garaje ejecutada satisfactoriamente', garaje: garajeActualizado });
    } catch (error) {
        logger.error('GarageController', 'Excepción crítica en la rampa de inserciones de reemplazo de mutaciones.', error);
        next(error);
    }
}

/**
 * Consulta del panel administrativo orientada a resolver las solicitudes atascadas en la capa preventiva antifraude.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const getPendingGarages = async (req, res, next) => {
    try {
        const garages = await prisma.garaje.findMany({
            where: { esta_aprobado: false },
            include: {
                dueno: { select: { nombre_completo: true, correo: true } },
                imagenes: true
            }
        });

        const garagesWithUrls = await Promise.all(garages.map(async (g) => {
            let docUrl = null;
            if (g.documento_propiedad_url) {
                try {
                    docUrl = await getDynamicPresignedUrl(g.documento_propiedad_url);
                } catch (urlErr) {
                    logger.error('GarageController', `Lapsus en compilación de identificador asimétrico asíncrono sobre ${g.id}`, urlErr);
                }
            }
            return { ...g, documento_propiedad_presigned: docUrl };
        }));

        logger.info('GarageController', `Auditoría global de repositorios rezagados. Activos localizados: ${garagesWithUrls.length}`);

        res.json({ count: garagesWithUrls.length, garages: garagesWithUrls });
    } catch (error) {
        logger.error('GarageController', 'Rotura genérica proveniente desde controlador auditor de inmuebles.', error);
        next(error);
    }
}

/**
 * Otorgamiento de facultades operacionales sobre un espacio por un alto mando.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const approveGarage = async (req, res, next) => {
    try {
        const { idGaraje } = req.params;

        const garage = await prisma.garaje.findUnique({
            where: { id: idGaraje },
            include: { dueno: true, imagenes: true }
        });

        if (!garage) {
            return res.status(404).json({ error: 'Resolución abortada. ID de activo inviable.' });
        }

        if (garage.dueno.esta_verificado !== 'VERIFICADO') {
            return res.status(400).json({ 
                error: 'Requisito transaccional KYC insatisfecho operativamente por parte del oferente.',
                status: garage.dueno.esta_verificado,
            });
        }

        if (!garage.documento_propiedad_url) {
            return res.status(400).json({ error: 'Faltan requerimientos habilitantes de validez registral.' });
        }

        if (garage.imagenes.length === 0) {
            return res.status(400).json({ error: 'Condición comercial publicitaria (Galería) ausente.' });
        }

        const approvedGarage = await prisma.garaje.update({
            where: { id: idGaraje },
            data: { esta_aprobado: true }
        });

        const io = req.app.get('socketio');
        if (io && garage.id_dueno) {
            io.to(garage.id_dueno).emit('garage_approved', {
                message: 'Verificación administrativa favorable. Local operativo para el público.',
                garageId: idGaraje
            });
        }

        if (garage.id_dueno) {
            await prisma.notificacion.create({
                data: {
                    id_usuario: garage.id_dueno,
                    titulo: 'Asignación Aprobada',
                    cuerpo: `La validación contractual sobre la entidad "${garage.nombre}" es ahora formalmente legalizada en plataforma.`
                }
            });
        }

        logger.info('GarageController', `Auditoría concedió libertad jurídica a local con ID: ${idGaraje}`);

        res.json({ message: 'Visto Bueno de Operaciones completado transaccionalmente de forma exitosa.', garage: approvedGarage });
    } catch (error) {
        logger.error('GarageController', 'Contingencia perjudicial interrumpe confirmaciones.', error);
        next(error);
    }
}

/**
 * Subsistema de entrega controlada para respaldos legales (Archivero Privilegiado).
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const uploadPropertyDoc = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'Omisión de cuerpo adjunto (multipart).' });
        }

        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Capacidad operativa no vinculada a este perímetro.' });
        }

        const key = await uploadFilePrivate(req.file, 'garajes-docs');

        await prisma.garaje.update({
            where: { id: idGaraje },
            data: { documento_propiedad_url: key }
        });

        logger.info('GarageController', `Incorporación de documento titular resuelta herméticamente en depósito. ID Oculto generado: ${key}`);

        res.json({ message: 'Provisión de documentación de integridad finalizada sin inconvenientes.', key });
    } catch (error) {
        logger.error('GarageController', 'Incidencia reportada durante canalización restringida de archivos documentales', error);
        next(error);
    }
}

/**
 * Rutina demoledora para el apagado definitivo y clausura persistente (con baja recursiva) de las operaciones.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const deleteGaraje = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje } = req.params;

        const garaje = await prisma.garaje.findUnique({
            where: { id: idGaraje },
            include: { imagenes: true }
        });

        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'No existen prerrogativas suficientes de eliminación sobre esta variable.' });
        }

        const deleteImgPromises = garaje.imagenes.map(img => deleteFilePublic(img.url));
        await Promise.all(deleteImgPromises);

        if (garaje.documento_propiedad_url) {
            await deleteFilePrivate(garaje.documento_propiedad_url);
        }

        await prisma.garaje.delete({ where: { id: idGaraje } });

        logger.info('GarageController', `Erradicación técnica del componente base de Garaje procedió integralmente. ID Extinto: ${idGaraje}`);

        res.json({ message: 'Desintegración de elementos en cascada efectuada plenamente.' });
    } catch (error) {
        logger.error('GarageController', 'Dificultad irremediable durante proceso catártico de componentes foráneos dependientes.', error);
        next(error);
    }
}

/**
 * Recorte dirigido sobre una evidencia visual específica atada.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const deleteImagenGaraje = async (req, res, next) => {
    try {
        const id_dueno = req.user.id;
        const { idGaraje, idImagen } = req.params;

        const garaje = await prisma.garaje.findUnique({ where: { id: idGaraje } });
        if (!garaje || garaje.id_dueno !== id_dueno) {
            return res.status(403).json({ error: 'Autorización insuficiente atribuible al portador de identidad transaccional.' });
        }

        const imagen = await prisma.imagenGaraje.findUnique({ where: { id: idImagen } });
        if (!imagen || imagen.id_garaje !== idGaraje) {
            return res.status(404).json({ error: 'Incoherencia relacional, puntero fotográfico extraviado.' });
        }

        await deleteFilePublic(imagen.url);

        await prisma.imagenGaraje.delete({ where: { id: idImagen } });

        logger.info('GarageController', `Expulsión gráfica singular consumada en origen inmutable y repositorio externo. ID: ${idImagen}`);

        res.json({ message: 'Conclusión de la destitución parcial efectuada con validez neta.' });
    } catch (error) {
        logger.error('GarageController', 'Descoordinación observada bajo ambiente extintivo de binarios estáticos', error);
        next(error);
    }
}

module.exports = {
    createGaraje,
    addHorario,
    addServicioAdicional,
    blockDate,
    addImagen,
    getMyGarages,
    getGarageById,
    updateGarage,
    getPendingGarages,
    approveGarage,
    uploadPropertyDoc,
    deleteGaraje,
    deleteImagenGaraje,
    deleteServicioAdicional
};
