const prisma = require('../db/prisma');
const logger = require('../utils/logger');

/**
 * Motor de exploración espacial y temporal para la ubicación de establecimientos comerciales disponibles.
 * Emplea PostGIS para acotamiento radial y filtros paramétricos para rangos de horarios libres.
 * 
 * @param {import('express').Request} req - Petición HTTP.
 * @param {import('express').Response} res - Respuesta HTTP.
 * @param {import('express').NextFunction} next - Siguiente middleware.
 */
const searchGarajes = async (req, res, next) => {
    try {
        const { fecha, hora_inicio, hora_fin, lat, lng, radio_km } = req.query;
        
        const hasDateFilter = !!fecha;
        const searchHoraInicio = hora_inicio || '00:00';
        const searchHoraFin = hora_fin || '23:59';

        let whereFiltro = {
            esta_aprobado: true
        };

        if (lat && lng) {
            const radio = radio_km ? parseFloat(radio_km) * 1000 : 5000;
            
            const cercanosRaw = await prisma.$queryRaw`
                SELECT id FROM "Garaje"
                WHERE "ubicacion_geo" IS NOT NULL AND ST_DWithin(
                    "ubicacion_geo", 
                    ST_SetSRID(ST_MakePoint(${parseFloat(lng)}, ${parseFloat(lat)}), 4326)::geography, 
                    ${radio}
                )
            `;
            
            const idsCercanos = cercanosRaw.map(g => g.id);
            whereFiltro.id = { in: idsCercanos };
        }

        const garajes = await prisma.garaje.findMany({
            where: whereFiltro,
            include: {
                horarios_semanales: true,
                fechas_bloqueadas: true,
                reservas: {
                    include: { fechas: true },
                    where: { estado: { notIn: ['CANCELADA', 'REEMBOLSADA'] } }
                },
                imagenes: true,
                servicios_adicionales: true,
                dueno: {
                    select: {
                        id: true,
                        nombre_completo: true,
                        url_foto_perfil: true
                    }
                }
            }
        });

        const garajesDisponibles = hasDateFilter ? garajes.filter(garaje => {
            const searchDate = new Date(fecha);
            const dayOfWeek = searchDate.getDay();
            
            const horarioHoy = garaje.horarios_semanales.find(h => h.dia_semana === dayOfWeek);
            
            if (garaje.horarios_semanales.length > 0) {
                if (!horarioHoy || !horarioHoy.abierto) return false;

                if (hora_inicio && hora_fin) {
                    if (searchHoraInicio < horarioHoy.hora_inicio || searchHoraFin > horarioHoy.hora_fin) {
                        return false;
                    }
                }
            }

            const estaBloqueada = garaje.fechas_bloqueadas.some(fb =>
                fb.fecha.toISOString().split('T')[0] === fecha
            );
            if (estaBloqueada) return false;

            let reservasSolapadas = 0;
            const timeToMinutes = (timeStr) => {
                const [h, m] = timeStr.split(':').map(Number);
                return (h * 60) + m;
            };

            const searchStartMin = timeToMinutes(searchHoraInicio);
            const searchEndMin = timeToMinutes(searchHoraFin);

            garaje.reservas.forEach(reserva => {
                let reservaChoca = false;
                reserva.fechas.forEach(fr => {
                    if (fr.fecha.toISOString().split('T')[0] === fecha) {
                        const resStartMin = timeToMinutes(fr.hora_inicio);
                        const resEndMin = timeToMinutes(fr.hora_fin) + garaje.tiempo_limpieza;

                        if (searchStartMin < resEndMin && searchEndMin > resStartMin) {
                            reservaChoca = true;
                        }
                    }
                });

                if (reservaChoca) {
                    reservasSolapadas++;
                }
            });

            if (reservasSolapadas >= garaje.capacidad_puestos) return false;

            return true;
        }) : garajes;

        const responseData = garajesDisponibles.map(g => {
            const { reservas, fechas_bloqueadas, horarios_semanales, ...cleanGaraje } = g;
            return cleanGaraje;
        });

        logger.info('SearchController', `Barrido métrico retornado de manera exitosa. Elementos procesados útiles: ${responseData.length}`);

        res.json({
            message: 'Análisis de disponibilidad culminado sistemáticamente',
            total_encontrados: responseData.length,
            garajes: responseData
        });

    } catch (error) {
        logger.error('SearchController', 'Caída transaccional imprevista al iterar sub-condiciones geográficas', error);
        next(error);
    }
}

module.exports = {
    searchGarajes
};
