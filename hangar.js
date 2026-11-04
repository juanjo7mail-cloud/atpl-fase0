/* ATPL Fase 0 · HANGAR — aviso de «web en mantenimiento» (broma). Solo en la web con cuenta.
   El admin lo activa en STATS. A quien lleve 30 min de uso activo desde la activación le sale un aviso que no se cierra
   hasta acertar 7 de 9 preguntas (una por asignatura, nivel medio-alto, solo temario dado). Si suspende: ve las correctas y otras 9 distintas.
   Una vez liberado, no vuelve a salir (se guarda en el dispositivo y en la cuenta).
   API: F0Hangar.init({sb,user,admin}) · .preview() · .adminGet() · .adminSet(on,newEd) · .show({ed,preview,bar,onFree}) · .hide() · .stop() */
(function(){
"use strict";
const NEED=7, TOTAL=9, LIMIT=30*60;          // aciertos necesarios, preguntas, segundos de uso activo
const SUBJ=["010","021","031","040","050","061","070","081","090"];
const NAME={"010":"Air Law","021":"Aircraft General Knowledge","031":"Mass & Balance","040":"Human Performance","050":"Meteorology","061":"Navigation","070":"Operational Procedures","081":"Principles of Flight","090":"Communications"};
const QS=[["010","Seen by a pilot on final approach, the threshold lights and the runway end lights are:","Green at the threshold, red at the end","Red at the threshold, green at the end","White at the threshold, red at the end","Green at both ends of the runway","Umbral verde hacia la aproximación; fin de pista rojo hacia la pista."],["010","Survivors lay out the letter X on the ground. It means:","We require medical assistance","We require assistance","Proceeding in this direction","Yes, affirmative","X = necesitamos asistencia médica. V = necesitamos ayuda."],["010","The difference between a control zone (CTR) and a control area (CTA) is that:","A CTR starts at the surface, a CTA at a specified height","A CTA starts at the surface, a CTR at a specified height","A CTR is uncontrolled, a CTA is controlled","A CTR is only for IFR, a CTA only for VFR","CTR: desde la superficie. CTA: desde un límite especificado por encima del terreno."],["010","For which of the following is a flight plan NOT automatically required under SERA?","A local VFR training flight within Class G airspace that does not cross any border","Any IFR flight","Any flight crossing an international border","Any VFR flight planned to operate at night leaving the vicinity of an aerodrome","Vuelo local VFR en clase G sin cruzar frontera: no es automáticamente obligatorio. Cruzar frontera, IFR y vuelos nocturnos que salgan del aeródromo sí lo son."],["010","Which statement correctly describes the identification beacon at a civil land aerodrome?","It emits a green light with the aerodrome identifier in Morse code","It alternates white and green flashes with no identifier","It emits a white light with the identifier in Morse code","It emits a green steady light with no Morse identifier","Faro civil: verde + identificación en código Morse. El blanco/verde alternante es para aeródromos de agua."],["010","VMC are met when visibility, distance from cloud and ceiling are:","Equal to or better than the specified minima","At least twice the specified minima","Equal to or better than the IFR minima","Reported by ATC as CAVOK","VMC = las tres magnitudes iguales o mejores que los mínimos especificados."],["010","Climbing through 3000 ft AMSL in Class G airspace, what changes in the VFR cloud separation required?","It becomes 1500 m horizontally and 1000 ft vertically","Nothing: clear of cloud is still enough","It becomes 300 m horizontally","Cloud separation no longer applies","Por encima de 3000 ft (o 1000 ft sobre el terreno) se exige 1500 m y 1000 ft de las nubes."],["010","Which combination defines Visual Meteorological Conditions?","Visibility + distance from cloud + ceiling","RVR + ceiling","Visibility + slant distance from cloud","Ceiling + wind","Tres elementos: visibilidad, distancia a nubes, techo."],["010","In Class D airspace, which flights are separated from each other by ATC?","IFR flights from other IFR flights only","All flights from all other flights","VFR flights from IFR flights only","No flights; only information is given","Clase D: solo IFR con IFR. Los VFR reciben información de tráfico de todos."],["010","A Terminal Control Area (TMA) handles:","Arriving, departing and transiting traffic","Only arriving traffic","Only departing traffic","Arriving and departing traffic only","La TMA no excluye el tráfico en tránsito: es un área de control como cualquier otra."],["010","Under the Chicago Convention, which State issues or validates the licences of the flight crew of an aircraft on an international flight?","The State in which the aircraft is registered","The State of the operator","The State over which the aircraft is flying","The State of the pilot's nationality","Art. 32: Estado de matrícula."],["010","Under Part-FCL, what is the minimum age at which a student pilot is permitted to fly solo?","16 years","14 years","17 years","18 years","16 años para el primer vuelo en solitario (Part-FCL). No confundir con PPL (17) ni ATPL (21)."],["010","Under ICAO, the lateral limits of a CTR extend at least how far from the aerodrome centre in the directions of approach?","5 NM","2 NM","10 NM","20 NM","Al menos 5 NM (9,3 km) desde el centro del aeródromo en las direcciones de aproximación."],["010","Two aircraft are converging at the same level. The aircraft that does NOT have right-of-way must:","Give way and not pass above, below or in front of the other","Maintain its speed and heading until the other aircraft passes","Climb above the other aircraft to increase separation","Reduce speed and wait for instructions from ATC","El que no tiene prioridad cede y no pasa por encima, por debajo ni por delante. El que tiene prioridad mantiene rumbo y velocidad."],["010","An aircraft on final approach receives a steady GREEN light from the tower. This means:","Cleared to land","Return for landing","Give way and continue circling","Land and proceed to the apron","Verde fija en vuelo = autorizado a aterrizar."],["010","Which of the following does NOT correctly describe the pilot-in-command?","The most senior pilot in the crew by seniority alone","The pilot responsible for the operation and safety of the aircraft","The pilot who has final authority over the disposition of the aircraft","The pilot who may deviate from the rules in the interest of safety","El PIC es el responsable de la operación y la seguridad, tiene autoridad final y puede desviarse por seguridad. No es simplemente el más antiguo."],["010","Who has the final authority as to the disposition of the aircraft while it is under their command?","The pilot-in-command","The operator","The air traffic controller","The State of Registry","SERA.2015: el PIC."],["010","At a runway holding position, no part of an aircraft may project beyond the yellow double-solid/double-dashed markings without:","An explicit ATC clearance to enter or cross the runway","Prior notification to the handling agent","Clearance from the airline dispatcher","Approval from the airport fire service","SERA: stop y mantener hasta autorización explícita del ATC para cruzar o entrar en la pista."],["010","What does ATC do when a pilot reports that a clearance is unsatisfactory?","Issues an amended clearance, if practicable","Cancels the flight plan","Declares an emergency","Nothing: the clearance must be followed","El ATC emite una autorización enmendada si es posible."],["010","A pilot flying over survivors in daylight wants to show that their ground signal has been understood. The pilot should:","Rock the aircraft's wings","Fly a steep turn to the right","Flash the landing lights twice","Fly low over the signal twice","De día, balanceo de alas. De noche, encender y apagar dos veces las luces de aterrizaje o de navegación."],["021","A mixture of 15:1 means:","15 kg of air for each kg of fuel","15 litres of fuel for each litre of air","15 % fuel in the air","15 parts of fuel to 1 of air","Aire:combustible en masa."],["021","As oil temperature increases, its viscosity:","Decreases","Increases","Stays the same","Increases, then decreases","Más caliente, más fluido."],["021","Taxiing and turning left, the turn coordinator shows:","Turn to the left, ball to the right","Turn to the left, ball to the left","Turn to the right, ball centred","Wings level, ball to the left","La bola sale hacia fuera."],["021","Which components make up the empennage?","Horizontal stabilizer and vertical stabilizer","Horizontal stabilizer and the trailing-edge flaps","Vertical stabilizer and the wing ailerons","Rudder and ailerons only","Empenaje = los dos estabilizadores, con elevator y rudder."],["021","Why is the electric boost pump switched on when changing tanks?","To keep fuel pressure if the new line has air","To increase the engine power","To heat the fuel","To empty the old tank faster","Evitar una pérdida de presión."],["021","Which mixture is rich?","10:1","15:1","18:1","20:1","Menos aire por parte de combustible = rica."],["021","To lower a high cylinder head temperature, the pilot can:","Enrich the mixture","Lean the mixture","Close the cowl flaps","Reduce the airspeed","Enriquecer enfría."],["021","A light aircraft with toe brakes normally has:","A separate master cylinder for each brake","A single master cylinder for all brakes","No master cylinder: a cable pulls the pads","A master cylinder on the nose wheel only","Cilindro por freno: permite frenar cada rueda por separado."],["021","Rotation about the longitudinal axis is called ___ and is controlled by the ___.","Roll / ailerons","Pitch / elevator","Yaw / rudder","Roll / rudder","Longitudinal → roll → alerones."],["021","Which of these is a leading-edge high-lift device that the course classifies as a FLAP?","Krueger flap","Slat","Fowler flap","Split flap","Krueger = flap de borde de ataque. El slat no es un flap."],["021","Fuel ice in a carburettor forms because:","The fuel absorbs heat as it vaporises","The fuel freezes in the tank","Water in the fuel boils","The mixture is too lean","Fuel ice."],["021","Exhaust gas temperature increases when:","Power (MAP and RPM) is increased","Power is reduced to idle","The mixture is set full rich","The cowl flaps are opened","Más potencia, más EGT."],["021","Unlike a turn needle, the turn coordinator also responds to:","The rate of roll and the rate of turn","The bank angle in degrees","The magnetic heading","The pitch attitude of the nose","Giro inclinado ~30°."],["021","By moving the control wheel fore and aft, the pilot changes the aerodynamic force produced by the:","False: the wheel deflects the elevator and changes the tail force","True: only the trim tab can change the elevator force","True: the elevator force depends only on the airspeed","False, but only on aircraft fitted with a stabilator","Adelante-atrás = elevator."],["021","Where does carburettor ice restrict the airflow first?","Around the throttle butterfly and in the venturi","In the fuel tank vents at the wingtips","On the propeller blades and the spinner","In the exhaust manifold near the cylinders","Venturi y mariposa."],["021","Leaning to peak EGT gives approximately the:","Chemically correct mixture","Richest possible mixture","Best cooling mixture","Idle cut-off position","EGT máxima ≈ mezcla químicamente correcta."],["021","The direct-reading magnetic compass works with:","A magnet aligned with the Earth's field","A gyro tied to the vertical","The static pressure","An electric motor","Imán."],["021","Ignition in a piston engine is supplied by:","The magnetos, which make their own current","The battery, through the master switch","The alternator, through the bus","The starter motor","Magnetos."],["021","The gas in an oleo strut:","Supports the load and acts as a spring","Damps the rebound through an orifice","Lubricates the torsion links","Cools the brake discs","Gas = muelle; aceite = amortiguador."],["021","Water in the fuel is best detected by:","Draining a sample from the sumps before flight","Reading the fuel gauge","Checking the fuel flow at full power","Smelling the fuel at the filler","Purgar."],["021","If the oil filter becomes clogged:","A bypass valve lets unfiltered oil through","The engine stops at once","The oil pressure always drops to zero","The oil temperature falls","Bypass del filtro."],["021","With a constant-speed propeller, power is set mainly with the:","Manifold pressure gauge (throttle)","Tachometer reading (propeller control)","Fuel-flow gauge (mixture control)","Cylinder head temperature (cowl flaps)","MAP."],["021","The yaw caused by the slipstream is greatest:","At full power and low speed, as on take-off","In a glide at idle","In high-speed cruise","With the propeller feathered","Despegue."],["021","An engine is run on fuel of too low an octane rating. The likely result is:","Detonation, high temperatures and damage","Smoother running and less power","Carburettor icing","Lower oil pressure only","Detonación."],["031","On a large aeroplane, which relationship between the structural limits is normal?","MTOM greater than MLM","MLM greater than MTOM","MZFM greater than MTOM","MRM smaller than MTOM","Lo normal es MTOM > MLM (y MRM > MTOM por el combustible de rodaje)."],["031","Which conditions give the best take-off performance?","Low elevation, low temperature, high pressure","High elevation, high temperature, low pressure","Low elevation, high temperature, low pressure","High elevation, low temperature, low pressure","Lo que da aire denso: bajo, frío, presión alta."],["031","As defined in the course, MTOW does NOT include:","The fuel used for start-up and taxi","The fuel used for the take-off run and initial climb","The payload offloaded before the engines are started","The crew and their baggage, who board after the ramp check","Diapositiva 19: MTOW no incluye el combustible de arranque y rodaje (eso está en la MRM)."],["031","Overweight: which pair of effects is correct?","Higher Vs and higher landing speed","Lower Vs and lower landing speed","Higher Vs and shorter landing distance","Lower fuel consumption and longer range","Más peso: Vs más alta, se aterriza más rápido y se necesita más distancia."],["031","An overweight aeroplane will achieve:","A smaller maximum climb angle and a lower maximum rate of climb","A larger climb angle but a lower rate of climb","A higher rate of climb","The same climb performance at a higher speed","Es lo que quiere decir el «Minor Vx and Vy» de la diapositiva: sube peor en ángulo y en régimen."],["031","Same aerodrome on two days: QNH 1030 and QNH 1000. Performance is better with:","QNH 1030: lower pressure altitude","QNH 1000: lower pressure altitude","QNH 1000: higher pressure altitude","Both, pressure altitude is the same","Más presión = PA más baja = mejor."],["031","Which statement about density altitude is correct?","High DA means thin air and worse performance","High DA means dense air and better performance","DA does not depend on temperature at all","DA always equals true altitude in flight","DA alta = aire poco denso = peor."],["031","Which statement about moments is NOT correct?","A heavier item always produces a larger moment, wherever it is placed","Moment = mass × arm","An item located exactly at the datum produces zero moment","An item forward of the datum produces a negative moment","El momento depende de la masa Y del brazo: una masa pequeña lejos puede dar más momento que una grande cerca, y en el datum es cero pese lo que pese."],["031","Which is NOT expected when an aircraft is overloaded?","A shorter take-off run","Reduced acceleration","A higher lift-off speed","A longer landing distance","La carrera se ALARGA. Lo demás sí pasa."],["031","Trip fuel is 120 kg. Contingency fuel, as taught in class, is:","6 kg","12 kg","2.4 kg","60 kg","5 % de 120 = 6 kg."],["031","Which is NOT a result of overloading an aircraft?","A slower stalling speed","A longer landing distance","A poorer cruise performance","A reduced rate of climb","La Vs sube, no baja."],["031","Altitude is the vertical distance measured from:","Mean sea level","The aerodrome","The 1013.25 hPa level","The ground below","Altitude: desde el nivel del mar (QNH)."],["040","The approximate composition of the atmosphere is:","Nitrogen 78 %, oxygen 21 %, other gases 1 %","Nitrogen 21 %, oxygen 78 %, other gases 1 %","Nitrogen 78 %, oxygen 21 %, carbon dioxide 1 %","Nitrogen 70 %, oxygen 29 %, other gases 1 %","78/21/1 «other gases». El CO₂ es solo 0,04 %."],["040","At 7,000 ft the outside temperature is +5 °C. The ISA deviation is:","ISA +4","ISA −4","ISA +10","ISA +5","ISA = 15 − 14 = +1. 5 − 1 = +4."],["040","According to the course, lung capacity and residual volume are:","Men 6 L, women 4 L; 25 % residual volume","Men 4 L, women 6 L; 25 % residual volume","Men 6 L, women 4 L; 50 % residual volume","Men and women 5 L; 10 % residual volume","Mujer 4 L, 25 % residual."],["040","Which statement about decompression sickness is NOT correct?","Bubbles form when the pressure increases","Nitrogen dissolves in the body under pressure","Bubbles form when the pressure is reduced","It is explained by Henry's law","Henry: al BAJAR la presión el nitrógeno sale en burbujas."],["040","Which statement is NOT correct?","Gas exchange happens in the bronchi","Gas exchange happens in the alveoli","Bronchioles carry the air to the alveoli","Capillaries surround the alveoli","En los alvéolos; bronquios y bronquiolos solo conducen el aire."],["040","A pilot with diarrhoea and vomiting who now feels a little better should:","Not fly","Fly if not taking medication","Fly if he feels fit enough","Fly only as co-pilot","Gastroenteritis: no apto (deshidratación, incapacitación súbita)."],["040","After 20 minutes in the dark, a pilot's eyes are:","Not yet fully dark-adapted","Fully dark-adapted","Adapted, but only the cones","Adapted for the rest of the flight","Faltan unos 10–20 min más: la adaptación completa es de 30–40 min."],["040","As altitude increases, atmospheric pressure:","Decreases","Increases","Stays the same","Decreases only in the stratosphere","Baja con la altura. La segunda falla por «always»: 1 hPa cada 8 m (27 ft) solo vale cerca del nivel del mar."],["040","A balloon is heated while the pressure stays the same. Its volume will:","Increase","Decrease","Stay the same","First decrease, then increase","Más temperatura → más volumen (a presión constante). «Inversely» es la trampa."],["040","Match in order — trapped gas expanding in the climb · hypoxia · decompression sickness:","Boyle · Dalton · Henry","Henry · Boyle · Dalton","Dalton · Henry · Boyle","Charles · Charles · Charles","Las cuatro importan en vuelo."],["040","Order the four stages of hypoxia from the lowest to the highest altitude:","Indifferent → compensatory → disturbance → critical","Compensatory → indifferent → critical → disturbance","Indifferent → disturbance → compensatory → critical","Critical → disturbance → compensatory → indifferent","Indiferente → compensatoria → alteración → crítica."],["040","Respiration brings ___ into the cells and removes ___:","Oxygen · carbon dioxide","Carbon dioxide · oxygen","Nitrogen · oxygen","Oxygen · nitrogen","Llevar oxígeno hasta las células (y sacar el CO₂)."],["040","In the alveoli, oxygen moves from ___ and CO₂ moves from ___:","The air into the blood · the blood into the air","The blood into the air · the air into the blood","The air into the bones · the bones into the air","Both from the blood into the air","El CO₂ pasa de la sangre al pulmón para expulsarlo."],["040","«The circulatory system helps maintain the body's internal balance (homeostasis).» This is:","True","False","Only true at altitude","Only true at night","Falso: sí ayuda a estabilizar temperatura y pH."],["040","Which parts of the ear contain air, and which contain liquid?","Outer and middle: air · inner: liquid","Outer: liquid · middle and inner: air","All three: liquid","All three: air","Externo y medio llevan aire; el interno, líquido (cóclea y canales semicirculares)."],["040","True or false: a downward-sloping runway looks shorter and makes you feel low on slope.","True","False","True, but only at night","True, but only in IMC","Verdadero: bajada = «too-low». Subida = «too-high»."],["040","Is the somatogyral illusion a threat for a pilot?","Yes","Not at all","Yes, but only if you are not familiar with it","Only while flying in IMC","Sí, siempre es una amenaza: la prevención es no fiarse de lo que se siente y volar con los instrumentos."],["040","After a dive to 40 ft on Saturday at 10:00, the earliest recommended time to fly is:","Sunday at 10:00","Saturday at 13:00","Saturday at 16:00","Monday at 10:00","Más de 30 ft → 24 h."],["040","The ISA lapse rate in the troposphere is about:","0.65 °C per 100 m (1.98 °C per 1,000 ft)","6.5 °C per 100 m (19.8 °C per 1,000 ft)","2 °C per 100 ft (20 °C per 1,000 ft)","1 °C per 27 ft (37 °C per 1,000 ft)","1,98 °C cada 1.000 ft = 0,65 °C cada 100 m. (En el PDF la opción «−6,5 °C/1000 m» también sería correcta: es lo mismo.)"],["040","Under normal conditions, the main stimulus that controls the rate of breathing is:","The level of carbon dioxide in the blood","The level of oxygen in the blood","The level of nitrogen in the blood","The body temperature","★ CO₂, primariamente."],["040","After a long, steady turn the pilot rolls wings level. The balance organs make him feel:","A turn in the opposite direction","Perfectly level","A climb","A stronger turn in the same direction","The leans: tras un viraje prolongado, al nivelar sientes que viras al lado contrario."],["040","On a visual approach without aids to an up-sloping runway, a pilot is likely to fly:","A shallower (lower) approach than intended","A steeper approach than intended","Exactly the intended approach path","A steeper approach that becomes shallower at the end","Al revés: pista cuesta arriba → parece que vas alto → te quedas bajo (shallower)."],["040","Which of these is NOT in the middle ear?","The cochlea","Air","The malleus, incus and stapes","The opening of the Eustachian tube","Oído medio: aire y los tres huesecillos. El líquido está en el oído interno."],["040","Which part of the eye does NOT detect light?","The lens","The retina","The rods","The cones","La retina."],["050","METAR LEVC 221030Z 09008KT CAVOK 24/M02 Q1018. What is the dew point?","−2 °C","+2 °C","+24 °C","+18 °C","24/M02: temperatura +24 °C, rocío −2 °C (la M es «menos»). Q1018 es el QNH."],["050","In the ISA, the temperature lapse rate below the tropopause is:","1.98 °C per 1000 ft","1.98 °C per 100 ft","0.65 °C per 1000 ft","2.5 °C per 1000 ft","1,98 °C/1000 ft = 0,65 °C/100 m. Los distractores cambian la unidad."],["050","In the dissipating stage of a thunderstorm, the cloud is dominated by:","Downdrafts","Updrafts only","Strong updrafts and downdrafts together","Neither updrafts nor downdrafts","Disipación: mandan las descendentes frías y ahogan a las ascendentes. Ascendentes y descendentes juntas es la fase madura."],["050","What is the main difference between a METAR and a TAF?","A METAR is an observation; a TAF is a forecast","A METAR is a forecast; a TAF is an observation","Both are forecasts for different periods","A TAF only reports winds aloft","METAR = lo que hay ahora. TAF = predicción para el aeródromo."],["050","At a coastal airport at night, with no strong general wind, the surface wind will most likely blow:","From the land towards the sea","From the sea towards the land","Parallel to the coast","It will always be calm","Al revés que la original: de noche, brisa TERRESTRE, de la tierra al mar (y más débil)."],["050","In the cumulus stage of a thunderstorm, the dominant vertical currents are:","Updrafts","Downdrafts","Updrafts and downdrafts in equal strength","There are no vertical currents","Fase cumulus, la primera: solo ascendentes, la nube creciendo y aún sin precipitación. Cuando aparecen las descendentes empieza la fase madura. «Final Stage» no existe."],["050","Which value is the ISA mean sea level pressure?","1013.25 hPa","1031.25 hPa","1113.25 hPa","1003.25 hPa","1013,25 mb, idéntico a 1013,25 hPa. Los distractores juegan con transponer dígitos: 1031 en vez de 1013. Léelo dos veces."],["050","Airframe icing (rime or clear ice) requires the aircraft to fly through:","Liquid water droplets at temperatures below 0 °C","Dry snow at temperatures below 0 °C","Ice crystals only","Liquid water at temperatures above +10 °C","Gotas de agua SUBENFRIADAS (supercooled): agua todavía líquida por debajo de 0 °C, que se congela al golpear el avión. La nieve y el hielo ya son sólidos y rebotan; no se adhieren."],["050","TAF LEMD 221100Z 2212/2318 27010KT 9999 SCT040. What period does this TAF cover?","30 hours","6 hours","18 hours","12 hours","2212/2318: del día 22 a las 12Z al día 23 a las 18Z = 24 + 6 = 30 horas."],["050","Frontal fog is typically associated with the continuous precipitation of a:","Warm front","Cold front","Col","Ridge","El frente cálido (warm front). Su lluvia continua satura el aire frío de debajo y forma niebla frontal. «Included front» ni siquiera existe: es relleno."],["050","When the pressure gradient force and the Coriolis effect are in balance and the isobars are straight, the wind is the:","Geostrophic wind","Gradient wind","Cyclostrophic wind","Katabatic wind","Viento geostrófico: el equilibrio entre la fuerza del gradiente de presión y Coriolis, que da un viento paralelo a isobaras rectas. Si las isobaras son curvas, entra la fuerza centrífuga y se llama viento del gradiente."],["050","The thunderstorm stage with the most severe hazards (heavy rain, hail and lightning) is the:","Mature stage","Cumulus stage","Dissipating stage","Initial stage","Fase madura: conviven ascendentes y descendentes, y es cuando caen la lluvia fuerte, el granizo y los rayos. También es la fase más peligrosa para volar. «Updraft Stage» no existe."],["050","Clear ice forms mainly from:","Large supercooled droplets that spread before freezing","Small supercooled droplets that freeze instantly","Dry snow","Water vapour freezing directly on the airframe","Al revés que la original: gotas GRANDES que se extienden antes de congelarse → clear ice, liso y transparente. Las pequeñas → rime."],["050","A thunderstorm needs a trigger action, a high moisture content and:","An unstable atmosphere","A stable atmosphere","A temperature inversion","A low moisture content","Inestabilidad y humedad abundante, más el disparo que inicia el ascenso. Las tres son necesarias: sin inestabilidad el aire no sigue subiendo solo, y sin humedad no hay nube ni calor latente que la alimente."],["050","Which conditions favour the formation of lenticular clouds?","Strong wind blowing across a mountain range","Calm wind over flat terrain","Fog over a lake","A land breeze at night","Necesitan relieve y viento: ascenso orográfico u ondas de montaña. Son estacionarias aunque el viento las atraviese, porque se forman en la cresta de la onda."],["050","Low pressure systems are characterized by:","Converging and ascending air","Subsidence","Diverging air at the surface","Clear skies and light winds","Pregunta al revés: la borrasca converge y asciende. La subsidencia es del anticiclón."],["050","On a night with moist air and light winds, which condition would PREVENT radiation fog?","A cloud cover that stops the ground from cooling","Clear skies, which let the ground cool by radiation","A long night, which gives more time to cool","Calm or light winds, which let the cold layer form","Pregunta al revés: las nubes impiden que el suelo irradie y se enfríe. Sin enfriamiento, no hay niebla de radiación."],["050","Stationary lenticular clouds downwind of a mountain range warn the pilot of:","Mountain waves and possible severe turbulence","A land breeze","Radiation fog forming","A katabatic wind at the surface only","Las nubes lenticulares son la firma visible de las ondas de montaña (mountain waves): turbulencia severa y corrientes verticales fuertes a sotavento. Verlas es un aviso, no un adorno."],["050","The boundary between the stratosphere and the mesosphere is the:","Stratopause","Tropopause","Mesopause","Thermopause","Cada pausa toma el nombre de la capa de debajo: la estratopausa cierra la estratosfera."],["050","Which METAR shows the strongest wind? LEBL 18012KT · LEMD 36008KT · LEVC 09025KT · LEPA 27018KT","LEVC","LEPA","LEBL","LEMD","Los dos últimos dígitos antes de KT son la intensidad: LEVC 25 kt es el más fuerte. El 36 de LEMD es la dirección (360°), no la velocidad."],["050","Drizzle is typically produced by:","Stratus","Cumulonimbus","Cumulus congestus","Cirrus","Llovizna. Las nubes estratiformes son planas y de poco desarrollo vertical, así que sus gotas son pequeñas. Los chubascos y la lluvia fuerte vienen de nubes cumuliformes, que tienen recorrido vertical para hacer gotas grandes."],["050","The first cloud type that normally announces the approach of a warm front is:","Cirrus","Nimbostratus","Cumulonimbus","Stratus","La secuencia del frente cálido empieza alta y fina: cirrus → cirrostratus → altostratus → nimbostratus."],["061","One nautical mile is approximately:","6,080 ft (1,852 m)","5,280 ft (1,609 m)","3,280 ft (1,000 m)","6,080 m","1 NM ≈ 6.080 ft = 1.852 m. 5.280 ft es la milla terrestre."],["061","Flying at a density altitude of about 4,000 ft with 100 kt indicated, the true airspeed will be about:","106 kt, higher than the IAS","94 kt, lower than the IAS","100 kt, the same as the IAS","132 kt","En altura el aire es menos denso: TAS > IAS. Con el computador ≈ 106 kt."],["061","Northern hemisphere: you turn left from 060°M onto north using the magnetic compass. When you are actually heading 360°M, the compass:","Still shows a heading short of north (about 020°), as if you had to keep turning","Already shows a heading past north (about 340°)","Shows exactly 360°","Shows 090° and then settles","La brújula se retrasa al virar hacia el norte en el HN: aún marca ≈ 020. Hay que sacar el viraje antes (Undershoot North)."],["061","A direct-reading magnetic compass gives its most reliable indications:","Near the magnetic equator","Near the magnetic poles","Above 60° of latitude","Near the geographic poles","Cerca del ecuador magnético: dip 0 y H máxima."],["061","With a headwind component on the track, the ground speed is:","Lower than the TAS","Higher than the TAS","Equal to the TAS","Independent of the wind","Viento de cara: GS = TAS − componente. Con viento de cola, GS > TAS."],["061","At a ground speed of 120 kt, how long does it take to fly 50 NM?","25 minutes","24 minutes","42 minutes","30 minutes","50 / 120 × 60 = 25 min."],["061","Flight time 1 h 15 min with a consumption of 36 litres per hour. Fuel used:","45 litres","40.5 litres","36 litres","54 litres","36 × 1,25 = 45 L."],["061","You use 12 gal to fly 80 NM. In similar conditions, how much fuel for a further 140 NM?","21 gal","18 gal","24 gal","15 gal","12 / 80 = 0,15 gal/NM × 140 = 21 gal."],["061","Flight time 2 h 20 min, consumption 9 gal/h, required reserve 8 gal. Minimum fuel required:","29 gal","21 gal","26 gal","35 gal","2,33 h × 9 = 21 + 8 = 29 gal."],["061","On a radar controller's display, secondary surveillance radar (SSR) information is:","Shown on the same screen as the primary radar returns","Shown on a separate screen","Only shown when the transponder is switched off","Not displayed, only printed","Primario y secundario se presentan juntos."],["061","A QDM is:","The magnetic heading to steer (zero wind) to reach the station","The magnetic bearing from the station","The true bearing to the station","The true bearing from the station","QDM = rumbo magnético hacia la estación."],["061","Compass heading 210°, deviation 4°W, variation 8°E. The true heading is:","214°","206°","222°","198°","210 − 4 W = 206 M; 206 + 8 E = 214 T."],["061","True heading 145°, variation 9°W, deviation 3°E. The compass heading is:","151°","157°","139°","133°","145 + 9 W = 154 M; 154 − 3 E = 151 C."],["061","True course 090°, variation 4°W, deviation +2 (E), wind calm. Compass heading to fly to a beacon at a relative bearing of 040°?","132°","124°","128°","050°","090 + 040 = 130 T; 130 + 4 W = 134 M; 134 − 2 E = 132 C."],["061","The standard time kept in a country is:","Set by its government, normally UTC plus or minus a fixed amount","The LMT of its capital city","The apparent solar time of its central meridian","Always the same as UTC","Decisión política: UTC ± una cantidad fija."],["061","Desired true track 180°, TAS 100 kt, wind 270/20, zero variation. The heading to steer is about:","191°","169°","180°","200°","Viento por la derecha (desde el oeste, track sur): corregir a la derecha ≈ 11–12° → 191."],["061","Wind 300°/15 kt, desired true course 360°, TAS 90 kt. Required true heading is about:","352°","008°","360°","345°","Viento por la izquierda: corregir a la izquierda ≈ 8° → 352."],["061","Wind 180°/25 kt, TAS 110 kt, desired true course 240°, zero variation. The heading to steer is about:","229°","251°","240°","215°","Viento por la izquierda: corregir a la izquierda ≈ 11° → 229."],["061","Which of these is a great circle?","A meridian together with its anti-meridian","The parallel of 45°N, halfway between the equator and the pole","The Tropic of Cancer, at 23½°N","The Arctic Circle, at about 66½°N","Meridiano + antimeridiano pasa por el centro de la Tierra. Los paralelos (no ecuador) son small circles."],["070","On approach, a 20 kt headwind suddenly becomes a 10 kt tailwind. The immediate change in IAS is about:","−30 kt","−10 kt","+30 kt","0 kt","20 de cara a 10 de cola: 30 kt menos de golpe."],["070","In a level turn at 45° of bank, the load factor is about:","1.4 g","1.15 g","2 g","1 g","n = 1/cos 45° ≈ 1,41."],["070","Engine start 10:00, first moves to taxi 10:05, take-off 10:15, landing 11:15, comes to rest at the stand 11:22, engine off 11:24. Flight time is:","1 h 17 min","1 h 00 min","1 h 24 min","1 h 07 min","Desde 10:05 (primer movimiento) a 11:22 (se para): 1 h 17 min."],["070","A runway that is simply wet, with no standing water, is:","Not contaminated","Contaminated","Flooded","Damp","Mojada sin agua estancada no es contaminada."],["070","A runway-holding position sign is coloured:","White on red","Black on yellow","Yellow on black","Red on white","Es un letrero de instrucción obligatoria: blanco sobre rojo."],["070","From least to most serious, the three SAR emergency phases are:","Uncertainty → Alert → Distress","Alert → Uncertainty → Distress","Uncertainty → Distress → Alert","Alert → Distress → Uncertainty","Incertidumbre, alerta (aprensión), socorro."],["070","From driest to wettest, the order is:","Damp → Wet → Contaminated (standing water)","Wet → Damp → Contaminated (standing water)","Contaminated → Damp → Wet (standing water)","Damp → Contaminated → Wet (standing water)","Damp (color), wet (mojada), contaminated (agua estancada)."],["070","After sunset, the centre of the sun is 9° below the horizon. It is:","Night: civil twilight has ended","Day","Civil twilight","Nautical twilight, so still day","Más de 6° por debajo = noche legal, aunque sea crepúsculo náutico."],["070","Short final runway 27 at 65 kt IAS. The wind changes suddenly from 270/15 to 090/05. The immediate effect is:","IAS drops by about 20 kt: risk of stall","IAS rises by about 20 kt","IAS is unchanged; only ground speed changes","IAS drops by about 10 kt","15 kt de cara pasan a 5 de cola: pierdes 20 kt de golpe."],["070","In the generic carburettor fire checklist, mixture and throttle are set to:","Mixture idle cut-off, throttle open","Mixture rich, throttle closed","Mixture idle cut-off, throttle closed","Mixture rich, throttle open","Mezcla ICO para cortar combustible, gases abiertos para tragar aire y llamas."],["070","In the signals area you see a red and yellow striped arrow bent ANTICLOCKWISE (pointing left). It means:","Left-hand circuits are in force","Right-hand circuits are in force","Taxi to the left","Landing prohibited","La flecha marca el sentido del circuito: girada a la izquierda, circuito por la izquierda."],["070","Your engine fails over the sea, out of gliding range of land. Radio and transponder: what first?","Transmit MAYDAY and squawk 7700 as soon as possible","Transmit PAN PAN and squawk 7600","Squawk 7500 and wait for ATC","Wait until below 1000 ft to save battery, then transmit","MAYDAY y 7700 cuanto antes (y alto: más alcance)."],["070","A private VFR flight enters Class D airspace at 4000 ft. Absent special exemptions, the minimum equipment required is:","A VHF communication radio","A VHF radio and a Mode C transponder","A VHF radio and a VOR receiver","A transponder only","Clave del trial: VHF-COM."],["070","TORA 1800 m, stopway 200 m, clearway 300 m. The ASDA is:","2000 m","2100 m","2300 m","1800 m","ASDA = TORA + stopway = 1800 + 200."],["070","The engine stops and you have no choice but to land in a field. This is:","A forced landing","A precautionary landing","A diversion","A go-around","Inevitable = forced landing. Una precautionary la eliges tú, con motor."],["070","On an overwater flight in a single-engine aeroplane, who should WEAR a life jacket?","The pilot and the passengers, uninflated","Only the pilot","Only the passengers","Nobody: they are stowed in the rear locker","Todos lo llevan puesto y nadie lo infla dentro (respuesta 1 y 3 del trial)."],["070","Fine, light grey or white smoke with an acrid smell coming from the instrument panel suggests:","An electrical fire","An oil fire in the engine","Carburettor icing","A fuel leak in the cabin","Olor acre + humo fino gris claro/blanco = eléctrico."],["070","Which wind is most likely to hold a wake vortex over the runway?","A light crosswind","A strong crosswind","A strong headwind","A gusty wind above 25 kt","El cruzado ligero frena al torbellino de barlovento sobre la pista."],["070","Which lights must an aeroplane flying at night have, among others?","The lights required in flight and a landing light","A strobe light and the cabin lights only","A landing light, but no navigation lights","The navigation lights, but no landing light","Noche: luces reglamentarias, luz de aterrizaje, iluminación de instrumentos, linterna por puesto."],["070","On every flight, which combination of equipment is required?","Fire extinguisher, first aid kit and spare fuses","Torch, life jackets for all and a VHF radio","First aid kit, life raft and a VHF radio","Fire extinguisher, ELT and a survival kit","Lo del trial con otro orden."],["070","With calm air or a light headwind, wake vortices from a landing aircraft tend to:","Sink and move outwards, away from the runway centreline","Rise above the flight path","Converge on the centreline","Stay stationary over the touchdown zone","Sin cruzado, cada torbellino baja y se separa hacia fuera."],["070","Near a thunderstorm, the wind shear you may meet is:","Both horizontal and vertical, with gusts","Only vertical","Only horizontal","Only inside the cell itself","Alrededor de la tormenta: horizontal y vertical, con rachas."],["070","The co-pilot is flying the aircraft. Who remains charged with the safe conduct of the flight?","The pilot-in-command","The co-pilot, while at the controls","The operator's chief pilot","ATC","El PIC, lleve o no los mandos."],["070","To an aircraft on the ground, which light signal means 'cleared for take-off'?","Steady green","Flashing green","Flashing white","Steady red","Verde fija en tierra = despegar. Intermitente = rodar."],["081","An aeroplane with a stall speed of 80 kt in level flight enters a 60° banked level turn. Its stall speed will be approximately:","113 kt","80 kt","160 kt","93 kt","80 × √2 ≈ 113 kt."],["081","In a balanced turn, the force acting at right angles to the wings is:","The total lift (total force)","The centripetal force","The centrifugal force","The weight","TOTAL FORCE (total lift), perpendicular a las alas. Su componente horizontal es la centripetal force; la centrifugal es aparente."],["081","The abbreviation MAC means:","Mean Aerodynamic Chord","Maximum Angle of Climb","Mean Aerofoil Camber","Maximum Aerodynamic Chord","MAC = Mean Aerodynamic Chord. En el trial es de respuesta escrita: escríbelo entero."],["081","Compared with straight and level flight at the same IAS, induced drag in a level turn is:","Greater, because more lift is required","Smaller, because the lift is inclined","The same","Zero","Más factor de carga → más lift necesaria → induced drag ∝ lift²."],["081","Wing sweepback has an effect on the stability about:","All three axes: longitudinal, lateral and normal","The lateral axis only, through the longitudinal dihedral effect","The longitudinal axis only, through the sweep angle","The normal axis only, through the fin","Sweepback (flecha) afecta a los TRES ejes: longitudinal, lateral y normal."],["081","Wingtip vortices and trailing edge vortices are both caused by:","The pressure difference between the upper and lower surfaces of the wing","Engine exhaust mixing with the airflow behind the trailing edge","Skin friction alone, acting in the boundary layer","The weight of the aircraft pressing down on the air","Ojo a la opción combinada: BOTH wingtip AND trailing edge vortices. Si solo marcas wingtip, fallas."],["081","When the speed of an aircraft increases, induced drag:","Decreases","Increases","Remains the same","Becomes equal to parasite drag","Induced drag sube al bajar la velocidad. (En el trial esta pregunta salió con dos opciones repetidas: la buena es esta.)"],["081","If the lift required is multiplied by four (constant CLmax), the stall speed will:","Double","Quadruple","Remain the same","Halve","Vs ∝ √lift: √4 = 2."],["081","The first parameter to change when an aircraft enters vertical wind shear is its:","Airspeed","Ground speed","Altitude","Heading","Lo inmediato es la AIR SPEED (IAS); después cambian AoA, sustentación y altitud."],["081","If the aircraft weight is reduced, the stalling IAS will:","Decrease","Increase","Remain the same","Increase only with flaps up","Menos peso → menos sustentación necesaria → stall speed más baja."],["081","If lift is doubled, induced drag will:","Increase about four times","Double","Halve","Remain the same","Induced drag ∝ lift²: 2² = 4."],["081","At a constant airspeed, a decrease in angle of attack will cause the lift to:","Decrease","Increase","Remain the same","Become zero","A velocidad constante, más AoA → más CL → more lift (hasta el stall)."],["090","ATC gives a time on the hour, 1500 UTC. How should it be transmitted?","Wun fife zero zero","Fifteen hundred","Wun fife hundred","Zero zero","Hora completa para evitar confusión, dígito a dígito."],["090","A readability of 3 on the readability scale means:","Readable but with difficulty","Readable now and then","Readable","Perfectly readable","3 = with difficulty."],["090","Aeronautical VHF voice channels are found between:","118 and 136.975 MHz","119 and 136.975 MHz","108 and 117.95 MHz","112 and 146.975 MHz","118–136,975."],["090","FL 110 is transmitted as:","Flight level one one zero","Flight level one hundred ten","One one zero flight level","Flight level eleven zero","«Flight level» primero y dígito a dígito."],["090","An aircraft descends while flying away from a VHF station. The maximum range of communication:","Decreases","Increases","Stays the same","First increases, then decreases","Más bajo = menos alcance."],["090","The frequency 124.175 is transmitted as:","Wun too fow-er day-see-mal wun sev-en fife","Wun too fow-er point wun sev-en fife","Wun too fow-er wun sev-en fife","Wun too fow-er day-see-mal wun sev-en","Seis dígitos con «decimal»."],["090","In messages about a climb to an altitude, the phraseology used in the exam is:","'Climb to altitude …'","'Climb altitude …'","'Climb level …'","'Climb … feet QNH' without 'to'","«to» + «altitude»."],["090","A pilot reports 'estimating Toledo four two'. He expects to be over Toledo:","At 42 minutes past the hour","In 42 minutes","At 04:02","At 4:20","Solo minutos = minuto 42 de la hora."],["090","The full name of ATIS is:","Automatic Terminal Information Service","Aerodrome Traffic Information Service","Automatic Terminal Information System","Aeronautical Terminal Information Service","Automatic Terminal Information Service."],["090","At the holding point and ready, the pilot reports:","'Ready for departure'","'Ready for take-off'","'Request take-off'","'Ready to go'","«Ready for departure»."],["090","Emergency conditions are classified as:","Distress and urgency","Mayday and Pan Pan","Alert and distress","Danger and urgent","Distress y urgency."],["090","Who may require an aircraft to change the type of its call sign in flight?","An ATSU, to avoid confusion","The pilot, to avoid confusion","Nobody: it is never changed","The operator, by radio","ATC."],["090","'Squawk charlie' asks the pilot to:","Select the ALT (mode C) position so that altitude is reported","Press the IDENT button on the transponder","Select the standby mode on the transponder","Set the code 7000 on the transponder","Charlie = modo C."],["090","You are already talking to an ATSU with an assigned squawk when an emergency occurs. You should:","Declare it on the frequency in use and keep the assigned code","Change to 121.5 MHz and 7700","Squawk 7700 and stay silent","Change to 121.5 MHz and keep the code","Frecuencia en uso y código asignado."],["090","May a pilot use the abbreviated call sign as soon as two-way contact is established?","No, only after the ground station has abbreviated it","Yes, always, as soon as two-way contact is established","Yes, if there is no risk of confusion with other aircraft","Yes, but only on the ground, during taxiing","Solo tras la estación de tierra."],["090","After the first contact with an ATSU, the pilot may start using an abbreviated call sign:","Only once the ATSU has used the abbreviated form","As soon as communication is satisfactory","From the second call, whatever the ATSU does","When the pilot considers there is no confusion","★ Lo decide la estación de tierra al abreviarlo ella primero."],["090","Apart from ATC, the words 'take-off' may be said by a pilot:","Only when reading back a take-off clearance","When reporting ready for departure at the holding point","When lined up on the runway and waiting","When requesting departure instructions","Solo al colacionar la autorización."],["090","Which transponder code indicates a communication failure?","7600","7700","7500","2000","7600."],["090","The SSR code for a general emergency is:","7700","7600","7500","7000","7700."],["090","'Squawk ident' means:","Operate the special identification feature (press IDENT)","Select mode C to report the altitude","Set the code 7000 on the transponder","Switch the transponder off for a few seconds","IDENT."],["090","You realise mid-transmission that you are speaking on the wrong frequency. The standard word to cancel what you said is:","Disregard","Cancel","Correction","Negative","DISREGARD."],["090","Which item may simply be acknowledged, without a full readback?","The aerodrome temperature and dew point","A runway to cross","An altitude to level off at","A newly assigned frequency","Temperatura y rocío no se colacionan."],["090","A condition of being threatened by serious and/or imminent danger and requiring immediate assistance is:","Distress","Urgency","Alert","Uncertainty","Distress."],["090","The time 0950 UTC, with no risk of confusion, can be transmitted as:","Fife zero","Niner fifty","Ten to ten","Fifty","Solo minutos, dígito a dígito."]];                            // [asignatura, pregunta, correcta, falsa1, falsa2, falsa3, explicación]
const CSS=`#fh{
  --night:#0B141C; --wall:#12202B; --steel:#1B2D3B; --line:#2B4153;
  --lamp:#FFB52E; --hazard:#F5C531; --ink:#E9EFF3; --muted:#92A6B5;
  --ok:#4FC98C; --bad:#F26A63; --blue:#6FB2E6;
  --lv-a:#1A2D6B; --lv-b:#33A1DA; --lv-tail:#1A2D6B;
  --disp:"Barlow Condensed","Barlow",system-ui,sans-serif;
  --body:"Barlow",system-ui,-apple-system,"Segoe UI",sans-serif;
  --mono:"JetBrains Mono",ui-monospace,Consolas,monospace;
  color-scheme:dark;
  position:fixed;inset:0;z-index:2147483000;overflow:auto;background:rgba(8,14,20,.95);backdrop-filter:blur(6px);
  padding:max(14px,env(safe-area-inset-top,0px)) max(16px,env(safe-area-inset-right,0px)) 40px max(16px,env(safe-area-inset-left,0px));
  display:flex;justify-content:center;align-items:flex-start;color:var(--ink);font:400 16px/1.5 var(--body);text-align:left}
#fh[hidden]{display:none}
#fh *{box-sizing:border-box}
#fh button{font:inherit;color:inherit}
#fh .sheet{width:100%;max-width:980px;border:1px solid var(--line);border-radius:8px;background:var(--wall);overflow:hidden;position:relative;box-shadow:0 30px 80px rgba(0,0,0,.55)}
#fh .hazard{height:12px;background:repeating-linear-gradient(-45deg,var(--hazard) 0 14px,#16120a 14px 28px)}
#fh .fh-scene{display:block;width:100%;height:auto;background:var(--night)}
#fh .testing .fh-scene{height:clamp(150px,22vh,210px)}
#fh .testing .sign{display:none}
#fh .loto{position:absolute;top:26px;right:14px;z-index:3;border:1px solid var(--line);background:rgba(11,20,28,.85);color:var(--muted);border-radius:4px;padding:6px 10px;font:600 12px var(--mono);letter-spacing:.08em;display:flex;gap:6px;align-items:center;cursor:not-allowed}
#fh .loto svg{width:14px;height:14px}
#fh .loto.shake{animation:fh-shake .4s}
@keyframes fh-shake{20%{transform:translateX(-5px)}40%{transform:translateX(5px)}60%{transform:translateX(-3px)}80%{transform:translateX(3px)}}
#fh .panel{padding:20px clamp(16px,4vw,32px) 28px}
#fh .tagrow{display:flex;flex-wrap:wrap;gap:8px 14px;align-items:center;margin:0 0 10px}
#fh .aog{background:var(--bad);color:#1a0706;font:700 13px var(--mono);letter-spacing:.12em;padding:4px 10px;border-radius:3px}
#fh .aog.ok{background:var(--ok);color:#06180f}
#fh .mono{font:500 12px var(--mono);letter-spacing:.08em;color:var(--muted);text-transform:uppercase}
#fh h3{font:700 clamp(30px,6vw,46px)/1 var(--disp);margin:0 0 8px;text-wrap:balance;color:var(--ink)}
#fh .panel p{max-width:62ch;margin:0 0 12px;color:#C9D5DD}
#fh .wo{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:var(--line);border:1px solid var(--line);border-radius:6px;overflow:hidden;margin:14px 0 18px}
#fh .wo div{background:var(--steel);padding:10px 14px}
@media(max-width:700px){#fh .wo{grid-template-columns:1fr}}
#fh .wo b{display:block;font:500 11px var(--mono);letter-spacing:.1em;color:var(--muted);text-transform:uppercase;margin-bottom:2px}
#fh .wo span{font:600 16px var(--disp);letter-spacing:.01em}
#fh .btn{background:var(--lamp);color:#1b1100;border:0;border-radius:4px;padding:12px 22px;font:700 18px var(--disp);letter-spacing:.03em;cursor:pointer}
#fh .btn:hover{filter:brightness(1.08)} #fh .btn:disabled{opacity:.35;cursor:not-allowed}
#fh .btn.ghost{background:transparent;color:var(--ink);border:1px solid var(--line)}
#fh :focus-visible{outline:2px solid var(--blue);outline-offset:2px}
#fh .bays{display:grid;grid-template-columns:repeat(9,1fr);gap:6px;margin:4px 0 16px}
#fh .bay{border:1px solid var(--line);border-radius:3px;padding:5px 0;text-align:center;font:500 12px var(--mono);color:var(--muted);background:var(--steel)}
#fh .bay.cur{border-color:var(--lamp);color:var(--lamp)}
#fh .bay.done{background:#233646;color:var(--ink)}
#fh .bay.good{border-color:var(--ok);color:var(--ok)} #fh .bay.bad{border-color:var(--bad);color:var(--bad)}
#fh .qcard{border:1px solid var(--line);border-radius:6px;background:var(--steel);padding:16px clamp(14px,3vw,22px)}
#fh .qcard .q{font:600 22px/1.3 var(--body);margin:6px 0 14px}
#fh .opt{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;background:var(--wall);border:1px solid var(--line);border-radius:5px;padding:11px 14px;margin:0 0 8px;cursor:pointer;font:400 17px/1.35 var(--body);color:var(--ink)}
#fh .opt:hover{border-color:#47667e}
#fh .opt i{font:700 13px var(--mono);font-style:normal;color:var(--muted);padding-top:3px}
#fh .opt[aria-checked="true"]{border-color:var(--lamp);background:rgba(255,181,46,.1)}
#fh .opt[aria-checked="true"] i{color:var(--lamp)}
#fh .nav{display:flex;justify-content:space-between;gap:10px;margin-top:14px;flex-wrap:wrap;align-items:center}
#fh .res{display:flex;gap:18px;align-items:center;flex-wrap:wrap;margin:6px 0 14px}
#fh .score{font:700 72px/.9 var(--disp)} #fh .score.bad{color:var(--bad)} #fh .score.ok{color:var(--ok)}
#fh .stamp{border:3px solid var(--ok);color:var(--ok);border-radius:6px;padding:6px 14px;font:700 22px var(--disp);letter-spacing:.08em;transform:rotate(-6deg);animation:fh-stamp .5s cubic-bezier(.2,1.4,.4,1) both}
#fh .stamp.bad{border-color:var(--bad);color:var(--bad)}
@keyframes fh-stamp{from{transform:rotate(-6deg) scale(2.4);opacity:0}to{transform:rotate(-6deg) scale(1);opacity:1}}
#fh .defects{margin:10px 0 16px;display:grid;gap:8px}
#fh .defect{border-left:3px solid var(--bad);background:var(--steel);padding:10px 14px;border-radius:0 5px 5px 0}
#fh .defect small{display:block;color:var(--muted);font:500 12px var(--mono);letter-spacing:.06em;text-transform:uppercase}
#fh .defect em{font-style:normal;color:var(--ok)}
#fh .defect .why{display:block;color:#AFC0CC;font-size:14px;margin-top:4px}
#fh .toast{position:fixed;left:50%;bottom:30px;transform:translate(-50%,20px);opacity:0;background:#0b1218;border:1px solid var(--lamp);color:var(--ink);padding:10px 16px;border-radius:6px;max-width:min(92vw,520px);text-align:center;transition:.25s;pointer-events:none;z-index:5}
#fh .toast.on{opacity:1;transform:translate(-50%,0)}
#fh .prevbar{background:#0b1218;border:1px dashed var(--lamp);color:var(--lamp);border-radius:6px;padding:8px 12px;margin:0 0 12px;font:600 13px var(--mono);letter-spacing:.06em;display:flex;gap:10px;align-items:center;justify-content:space-between;flex-wrap:wrap}
#fh .prevbar button{background:var(--lamp);color:#1b1100;border:0;border-radius:4px;padding:6px 12px;font:700 14px var(--disp);cursor:pointer}

/* livery */
#fh .lv-a{stroke:var(--lv-a);fill:none} #fh .lv-b{stroke:var(--lv-b);fill:none} #fh .lv-tail{fill:var(--lv-tail)} #fh .lv-bf{fill:var(--lv-b);stroke:none}

/* escena */
#fh .beacon{animation:fh-blink 1.1s steps(1) infinite}
@keyframes fh-blink{50%{opacity:.15}}
#fh .fh-wrench{transform-box:fill-box;transform-origin:0% 0%;animation:fh-wr 1.6s ease-in-out infinite}
@keyframes fh-wr{50%{transform:rotate(-14deg)}}
#fh .lampsw{transform-box:fill-box;transform-origin:50% 0;animation:fh-sw 5s ease-in-out infinite}
#fh .lampsw:nth-of-type(2n){animation-duration:6.2s;animation-delay:-2s}
@keyframes fh-sw{50%{transform:rotate(1.4deg)}}
#fh .flick{animation:fh-fl 3.7s steps(1) infinite}
@keyframes fh-fl{0%,100%{opacity:1}48%{opacity:.55}52%{opacity:1}80%{opacity:.8}}
#fh .cowl{transform-box:fill-box;transform-origin:100% 100%;animation:fh-cw 4s ease-in-out infinite}
@keyframes fh-cw{50%{transform:rotate(-3deg)}}
#fh .fh-lamp2{transform-box:fill-box;transform-origin:0% 100%;animation:fh-lm 2.4s ease-in-out infinite}
@keyframes fh-lm{50%{transform:rotate(-8deg)}}

/* operarios: trabajan, se apartan durante el test y vuelven si suspendes */
#fh .fh-m{transform:translate(0,0)}
#fh .fh-leg{transform-box:fill-box;transform-origin:50% 0}
#fh [data-crew=go] .fh-m1{animation:fh-m1go 3.4s linear forwards}
#fh [data-crew=go] .fh-m2{animation:fh-m2go 3.4s linear forwards}
#fh [data-crew=back] .fh-m1{animation:fh-m1back 3.4s linear forwards}
#fh [data-crew=back] .fh-m2{animation:fh-m2back 3.4s linear forwards}
#fh [data-crew=aside] .fh-m1{transform:translate(551px,0)}
#fh [data-crew=aside] .fh-m2{transform:translate(190px,0)}
#fh [data-crew=go] .fh-leg,#fh [data-crew=back] .fh-leg{animation:fh-walk .42s ease-in-out 8 alternate}
#fh [data-crew=go] .fh-l2,#fh [data-crew=back] .fh-l2{animation-direction:alternate-reverse}
#fh [data-crew=go] .fh-bob,#fh [data-crew=back] .fh-bob{animation:fh-bob .42s ease-in-out 8}
#fh [data-crew=aside] .fh-bob{animation:fh-nod 2.6s ease-in-out infinite}
#fh [data-crew=go] .fh-wrench,#fh [data-crew=aside] .fh-wrench,#fh [data-crew=back] .fh-wrench,#fh [data-crew=go] .fh-lamp2,#fh [data-crew=aside] .fh-lamp2,#fh [data-crew=back] .fh-lamp2{opacity:0;animation:none}
@keyframes fh-walk{from{transform:rotate(-24deg)}to{transform:rotate(24deg)}}
@keyframes fh-bob{50%{transform:translateY(-2.5px)}}
@keyframes fh-nod{50%{transform:translateY(1.5px)}}
@keyframes fh-m1go{0%{transform:translate(0,0)}100%{transform:translate(551px,0)}}
@keyframes fh-m1back{0%{transform:translate(551px,0)}100%{transform:translate(0,0)}}
@keyframes fh-m2go{0%{transform:translate(0,0)}100%{transform:translate(190px,0)}}
@keyframes fh-m2back{0%{transform:translate(190px,0)}100%{transform:translate(0,0)}}

/* salida del hangar: puertas, cielo, tractor y avión */
#fh #fh-outside{opacity:0;transition:opacity 1.6s ease .2s}
#fh #fh-door-l,#fh #fh-door-r{transition:transform 2.4s cubic-bezier(.6,0,.3,1)}
#fh .out #fh-outside{opacity:1}
#fh .out #fh-door-l{transform:translateX(-170px)} #fh .out #fh-door-r{transform:translateX(170px)}
#fh .fh-tug{opacity:0;transform:translateX(1100px)}
#fh #fh-plane,#fh .fh-tug{transform-origin:480px 292px;transform-box:view-box}
#fh .out .fh-tug{opacity:1;animation:fh-tug 9s linear forwards}
#fh .out #fh-plane{animation:fh-plane 9s linear forwards}
#fh .out .sign{opacity:0;transition:opacity .6s}
#fh .out .fh-tug .fh-w{transform-box:fill-box;transform-origin:50% 50%;animation:fh-spin .5s linear infinite}
@keyframes fh-spin{to{transform:rotate(-360deg)}}
@keyframes fh-tug{
  0%{transform:translateX(1100px);animation-timing-function:cubic-bezier(.2,.7,.3,1)}
  22%{transform:translateX(0);animation-timing-function:linear}
  30%{transform:translateX(0);animation-timing-function:cubic-bezier(.5,0,.7,1)}
  88%{transform:translate(0,-34px) scale(.09);opacity:1}
  100%{transform:translate(0,-34px) scale(.07);opacity:0}}
@keyframes fh-plane{
  0%,30%{transform:none;animation-timing-function:cubic-bezier(.5,0,.7,1)}
  88%{transform:translate(0,-34px) scale(.09);opacity:1}
  100%{transform:translate(0,-34px) scale(.07);opacity:0}}
@media (max-width:560px){#fh .testing .fh-scene{height:128px}#fh .bays{gap:3px}#fh .bay{font-size:10px}#fh .qcard .q{font-size:19px}#fh .loto span{display:none}}
@media (prefers-reduced-motion:reduce){#fh *{animation:none!important;transition:none!important}#fh .out #fh-plane,#fh .out .fh-tug{opacity:1;animation:fh-tug 9s linear forwards}
`;
const SVG=`  <svg class="fh-scene" id="fh-scene" data-crew="work" viewBox="0 0 960 380" role="img" aria-label="Un avión en un hangar, con dos mecánicos trabajando en el motor y en el fuselaje">
   <defs>
    <linearGradient id="fhgWall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1822"/><stop offset="1" stop-color="#152a38"/></linearGradient>
    <linearGradient id="fhgFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16232d"/><stop offset="1" stop-color="#0a1218"/></linearGradient>
    <linearGradient id="fhgFus" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3f6f8"/><stop offset=".55" stop-color="#cfd9e0"/><stop offset="1" stop-color="#8fa1ae"/></linearGradient>
    <linearGradient id="fhgWing" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b9c6cf"/><stop offset="1" stop-color="#7d909d"/></linearGradient>
    <radialGradient id="fhgCone" cx=".5" cy="0" r="1"><stop offset="0" stop-color="#ffd37a" stop-opacity=".55"/><stop offset="1" stop-color="#ffd37a" stop-opacity="0"/></radialGradient>
    <pattern id="fhstripe" width="16" height="16" patternUnits="userSpaceOnUse" patternTransform="rotate(-45)"><rect width="8" height="16" fill="#f5c531"/><rect x="8" width="8" height="16" fill="#16120a"/></pattern>
   <linearGradient id="fhgSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb6e8"/><stop offset=".7" stop-color="#cfe6f4"/><stop offset="1" stop-color="#ffe3a8"/></linearGradient>
   </defs>
   <!-- pared del fondo, puerta y cercha -->
   <rect width="960" height="380" fill="url(#fhgWall)"/>
   <g stroke="#223646" stroke-width="2" fill="none"><path d="M0 40H960M0 70H960"/><path d="M0 70L80 40L160 70L240 40L320 70L400 40L480 70L560 40L640 70L720 40L800 70L880 40L960 70"/></g>
   <g id="fh-doors">
    <rect x="250" y="96" width="460" height="196" fill="#0a131b"/><rect id="fh-outside" x="250" y="96" width="460" height="196" fill="url(#fhgSky)"/>
    <g id="fh-door-l"><rect x="250" y="96" width="230" height="196" fill="#1d3142" stroke="#2b4153"/><g stroke="#2b4153" stroke-width="2"><path d="M250 140H480M250 190H480M250 240H480"/></g></g>
    <g id="fh-door-r"><rect x="480" y="96" width="230" height="196" fill="#1d3142" stroke="#2b4153"/><g stroke="#2b4153" stroke-width="2"><path d="M480 140H710M480 190H710M480 240H710"/></g></g>
    <rect x="250" y="88" width="460" height="8" fill="url(#fhstripe)"/>
    <rect x="404" y="52" width="152" height="26" rx="3" fill="#0a131b" stroke="#2b4153"/><text x="480" y="71" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="700" font-size="14" letter-spacing="3" fill="#ffb52e">HANGAR 3</text>
   </g>
   <!-- suelo -->
   <rect y="292" width="960" height="88" fill="url(#fhgFloor)"/>
   <g stroke="#f5c531" stroke-width="2" opacity=".55"><path d="M0 318H960" stroke-dasharray="26 16"/><path d="M0 372H960" stroke-dasharray="26 16"/></g>
   <g stroke="#2b4153" stroke-width="1"><path d="M60 292L-60 380M240 292L190 380M480 292V380M720 292L770 380M900 292L1020 380"/></g>
   <!-- grúa puente -->
   <g stroke="#2b4153" stroke-width="3"><path d="M0 24H960"/></g>
   <g><rect x="610" y="18" width="46" height="12" fill="#f5c531"/><path d="M633 30V58" stroke="#5b7589" stroke-width="2" stroke-dasharray="4 3"/><path d="M627 58H639V68H627Z" fill="#5b7589"/></g>
   <!-- lámparas -->
   <g>
    <g class="lampsw"><path d="M170 40V66" stroke="#4d6477"/><path d="M150 82L170 66L190 82Z" fill="#c89a3a"/><path d="M150 82H190L330 300H30Z" fill="url(#fhgCone)" class="flick"/></g>
    <g class="lampsw"><path d="M400 40V66" stroke="#4d6477"/><path d="M380 82L400 66L420 82Z" fill="#c89a3a"/><path d="M380 82H420L560 300H240Z" fill="url(#fhgCone)" class="flick"/></g>
    <g class="lampsw"><path d="M640 40V66" stroke="#4d6477"/><path d="M620 82L640 66L660 82Z" fill="#c89a3a"/><path d="M620 82H660L800 300H500Z" fill="url(#fhgCone)"/></g>
    <g class="lampsw"><path d="M850 40V66" stroke="#4d6477"/><path d="M830 82L850 66L870 82Z" fill="#c89a3a"/><path d="M830 82H870L1000 300H710Z" fill="url(#fhgCone)" class="flick"/></g>
   </g>

   <!-- AVIÓN ESCUELA: bimotor de ala baja con puntas curvadas, tipo Tecnam P2006T (morro a la izquierda) -->
   <g id="fh-plane">
    <!-- lejano: hélice y ala del otro lado asomando por detrás -->
    <rect x="320" y="168" width="5" height="62" rx="2" fill="#1f2c38"/>
    <path d="M432 238L520 232L568 190L552 186L510 214L440 224Z" fill="#aebbc5"/><path class="lv-tail" d="M552 186L568 190L562 200L548 196Z"/>
    <!-- estabilizador y deriva -->
    <path d="M722 232L814 224L818 232L732 246Z" fill="url(#fhgWing)"/><path class="lv-tail" d="M804 225L814 224L818 232L808 233Z"/>
    <path class="lv-tail" d="M686 228L734 128H772L784 232Z"/><path class="lv-bf" d="M690 218L778 218L784 232L688 232Z"/>
    <!-- fuselaje -->
    <path d="M200 248C200 238 214 230 236 226L296 218C318 206 342 192 374 190H470C500 192 520 200 548 210L780 226L784 242L560 262L340 270C260 272 200 266 200 248Z" fill="url(#fhgFus)"/>
    <path class="lv-tail" d="M200 248C200 238 214 230 236 226L296 218C318 206 342 192 374 190L374 232C340 240 300 248 262 262L204 262C201 258 200 253 200 248Z"/>
    <path class="lv-tail" d="M374 232L540 228Q600 228 650 232L782 234L783 240L650 240Q590 240 540 238L374 242Z"/>
    <path class="lv-bf" d="M330 252Q430 244 540 246Q610 247 660 246L783 242L784 249L660 253Q600 254 540 254Q430 253 350 262Z"/>
    <!-- cabina -->
    <path d="M304 218C326 204 346 194 374 192H470C494 194 508 202 522 212L520 226H304Z" fill="#12202f"/>
    <path d="M330 206C346 198 360 194 380 193L372 224H316Z" fill="#fff" opacity=".1"/><path d="M430 193H470C488 195 500 201 512 208L470 224H420Z" fill="#fff" opacity=".07"/>
    <path d="M418 192V226" stroke="#2a4256" stroke-width="3"/>
    <text x="598" y="230" font-family="JetBrains Mono,monospace" font-weight="700" font-size="12" letter-spacing="2" fill="#173047" transform="rotate(2.500 598 230)">EC-ATP</text>
    <!-- ala cercana con punta curvada hacia arriba -->
    <path d="M380 252L492 258L526 284L446 288Z" fill="url(#fhgWing)"/><path d="M380 252L492 258" stroke="#f3f6f8" stroke-width="2"/>
    <path class="lv-tail" d="M500 282L536 246L544 248L524 286Z"/><path d="M380 252L446 288" stroke="#8fa3b0" stroke-width="1" opacity=".6"/>
    <!-- góndola del motor cercano, con el capó abierto -->
    <g><rect x="332" y="246" width="76" height="14" rx="3" fill="#33495a"/><circle cx="346" cy="250" r="5" fill="#51616e"/><circle cx="364" cy="250" r="5" fill="#51616e"/><circle cx="382" cy="250" r="5" fill="#51616e"/><circle cx="400" cy="250" r="5" fill="#51616e"/>
     <path d="M318 268Q318 260 330 260L408 262L412 284L330 286Q318 286 318 276Z" fill="url(#fhgFus)"/><path d="M326 272H404" stroke="#aebbc5" stroke-width="2"/></g>
    <g class="cowl"><path d="M408 258L414 248L344 226L332 238Z" fill="#c9d4db" stroke="#6a7f8e" stroke-width="1.500"/></g>
    <ellipse cx="314" cy="273" rx="7" ry="11" fill="#e6edf1"/><rect x="309" y="239" width="5" height="68" rx="2" fill="#1f2c38" opacity=".95"/>
    <!-- tren -->
    <g><path d="M262 268L258 294" stroke="#8d9fac" stroke-width="6"/><circle cx="256" cy="297" r="9" fill="#1a2630" stroke="#5d7283" stroke-width="3"/></g>
    <g><path d="M430 286L436 294" stroke="#8d9fac" stroke-width="7"/><circle cx="436" cy="296" r="10" fill="#1a2630" stroke="#5d7283" stroke-width="3"/></g>
    <!-- gatos -->
    <g fill="#f5c531"><path d="M392 272L376 304H408Z" opacity=".95"/><path d="M696 250L680 304H712Z" opacity=".95"/></g><g fill="#16120a"><rect x="374" y="302" width="36" height="5"/><rect x="678" y="302" width="36" height="5"/></g>
    <!-- baliza y etiqueta AOG -->
    <ellipse class="beacon" cx="760" cy="131" rx="7" ry="4" fill="#f26a63"/>
    <g><path d="M522 266L526 274" stroke="#8d9fac" stroke-width="1.500"/><rect x="504" y="274" width="46" height="22" rx="3" fill="#f26a63"/><text x="527" y="289" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="700" font-size="11" letter-spacing="1" fill="#1a0706">AOG</text></g>
   </g>

   <!-- mecánico 1 (junto al motor) -->
   <g class="fh-m fh-m1"><g class="fh-bob">
     <rect class="fh-leg fh-l1" x="277" y="288" width="6" height="16" rx="2" fill="#1a2630"/><rect class="fh-leg fh-l2" x="285" y="288" width="6" height="16" rx="2" fill="#1a2630"/>
     <rect x="275" y="262" width="18" height="28" rx="4" fill="#f08a24"/><circle cx="284" cy="253" r="8.500" fill="#e9b88f"/><path d="M274.500 251C274.500 239 293.500 239 293.500 251Z" fill="#f5c531"/>
     <g class="fh-wrench"><path d="M291 270L304 268" stroke="#e9b88f" stroke-width="6" stroke-linecap="round"/><path d="M302 268L314 262" stroke="#8d9fac" stroke-width="5" stroke-linecap="round"/><circle cx="318" cy="260" r="5.500" fill="none" stroke="#8d9fac" stroke-width="3"/></g>
   </g></g>
   <!-- mecánico 2 (cola) con lámpara -->
   <g class="fh-m fh-m2"><g class="fh-bob">
     <rect class="fh-leg fh-l1" x="682" y="286" width="6" height="18" rx="2" fill="#1a2630"/><rect class="fh-leg fh-l2" x="691" y="286" width="6" height="18" rx="2" fill="#1a2630"/>
     <rect x="680" y="262" width="19" height="26" rx="4" fill="#f08a24"/><circle cx="689.500" cy="253" r="8.500" fill="#e9b88f"/><path d="M680 251C680 239 699 239 699 251Z" fill="#f5c531"/>
     <g class="fh-lamp2"><path d="M681 270L664 258" stroke="#e9b88f" stroke-width="6" stroke-linecap="round"/><rect x="650" y="250" width="14" height="10" rx="2" fill="#f5c531" class="flick"/></g>
   </g></g>
   <!-- GPU, carro de herramientas, conos -->
   <g><rect x="552" y="262" width="74" height="40" rx="4" fill="#f5c531"/><rect x="560" y="270" width="28" height="16" fill="#16120a"/><circle cx="568" cy="306" r="6" fill="#0a131b"/><circle cx="612" cy="306" r="6" fill="#0a131b"/><path d="M552 284C520 284 500 272 492 262" fill="none" stroke="#e9eff3" stroke-width="3"/></g>
   <g transform="translate(702 0)"><rect x="40" y="262" width="62" height="40" rx="3" fill="#c94a3f"/><g fill="#8d2f27"><rect x="46" y="268" width="50" height="8"/><rect x="46" y="280" width="50" height="8"/><rect x="46" y="292" width="50" height="8"/></g><circle cx="52" cy="306" r="4" fill="#0a131b"/><circle cx="92" cy="306" r="4" fill="#0a131b"/></g>
   <g fill="#f08a24"><path d="M330 330L340 304L350 330Z"/><path d="M670 332L680 306L690 332Z"/><path d="M906 328L916 302L926 328Z"/></g><g fill="#fff" opacity=".9"><rect x="335" y="316" width="10" height="3"/><rect x="675" y="318" width="10" height="3"/><rect x="911" y="314" width="10" height="3"/></g>
   <!-- tractor de remolque (llega por delante del morro) -->
   <g class="fh-tug" id="fh-tug">
    <path d="M138 297L252 298" stroke="#8d9fac" stroke-width="5" stroke-linecap="round"/><circle cx="254" cy="298" r="4.500" fill="#f5c531"/>
    <rect x="132" y="282" width="14" height="16" rx="2" fill="#51616e"/>
    <rect x="24" y="272" width="116" height="32" rx="7" fill="#f08a24"/><rect x="24" y="298" width="116" height="6" fill="url(#fhstripe)"/>
    <path d="M64 272L72 242H124L132 272Z" fill="#f08a24"/><path d="M77 248H119L125 268H71Z" fill="#2a4256"/>
    <circle cx="97" cy="257" r="7" fill="#e9b88f"/><path d="M90 255C90 246 104 246 104 255Z" fill="#f5c531"/>
    <rect x="92" y="235" width="10" height="7" rx="2" fill="#ffb52e" class="beacon"/>
    <rect x="21" y="278" width="6" height="18" rx="2" fill="#1a2630"/><circle cx="29" cy="284" r="3" fill="#ffd37a"/>
    <g class="fh-w"><circle cx="52" cy="306" r="13" fill="#1a2630" stroke="#5d7283" stroke-width="3"/><path d="M52 296V316M42 306H62" stroke="#5d7283" stroke-width="2"/></g>
    <g class="fh-w"><circle cx="112" cy="306" r="13" fill="#1a2630" stroke="#5d7283" stroke-width="3"/><path d="M112 296V316M102 306H122" stroke="#5d7283" stroke-width="2"/></g>
   </g>
   <!-- cartel -->
   <g class="sign"><rect x="846" y="120" width="104" height="64" rx="3" fill="#16120a" stroke="#f5c531" stroke-width="2"/><text x="898" y="144" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="16" fill="#f5c531" textLength="86" lengthAdjust="spacingAndGlyphs">EN REVISIÓN</text><text x="898" y="164" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#e9eff3" letter-spacing="1">NO ARRANCAR</text><text x="898" y="177" text-anchor="middle" font-family="JetBrains Mono,monospace" font-size="10" fill="#e9eff3" letter-spacing="1">NO ENCENDER</text></g>
  </svg>`;
const $=(s,r)=>(r||document).querySelector(s);
const esc=s=>String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const shuffle=a=>{ a=a.slice(); for(let i=a.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; } return a; };
const LS={ get(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } }, set(k,v){ try{ localStorage.setItem(k,String(v)); }catch(e){} } };
const K={ t:e=>"f0:hg:t:"+e, trig:e=>"f0:hg:trig:"+e, ok:e=>"f0:hg:ok:"+e, seen:e=>"f0:hg:seen:"+e, last:"f0:hg:last" };

let root=null, panel=null, scene=null, sheet=null, inerted=[], crewT=0, toastT=0;
let S={ed:"", preview:false, bar:true, onFree:null, attempts:0, draw:[], ans:[], idx:0, seen:null, live:false };
let DEP={sb:null,user:null,admin:false}, flag=null, timer=0, poll=0, secs=0, savedAt=0, started=false;

/* ---------------- DOM ---------------- */
function build(){
  if(root) return;
  if(!$("#fh-fonts")){ const l=document.createElement("link"); l.id="fh-fonts"; l.rel="stylesheet"; l.href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;600&family=Barlow+Condensed:wght@500;600;700&family=JetBrains+Mono:wght@500;700&display=swap"; document.head.appendChild(l); }
  if(!$("#fh-css")){ const s=document.createElement("style"); s.id="fh-css"; s.textContent=CSS; document.head.appendChild(s); }
  root=document.createElement("div"); root.id="fh"; root.hidden=true; root.setAttribute("role","dialog"); root.setAttribute("aria-modal","true"); root.setAttribute("aria-labelledby","fh-lt");
  root.innerHTML=`<div class="sheet" id="fh-sheet"><div class="hazard"></div>
   <button class="loto" id="fh-loto" type="button" aria-label="Cerrar: bloqueado"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="3" y="7" width="10" height="7" rx="1.500"/><path d="M5 7V5a3 3 0 0 1 6 0v2"/></svg><span>LOTO</span></button>
   ${SVG}
   <div class="panel" id="fh-panel"></div><div class="hazard"></div></div><div class="toast" id="fh-toast" role="status"></div>`;
  document.body.appendChild(root);
  panel=$("#fh-panel",root); scene=$("#fh-scene",root); sheet=$("#fh-sheet",root);
  scene.setAttribute("role","img"); scene.setAttribute("aria-label","Un Tecnam P2006T, bimotor de escuela, en un hangar con dos mecánicos trabajando en el motor");
  $("#fh-loto",root).onclick=()=>{ const b=$("#fh-loto",root); b.classList.remove("shake"); void b.offsetWidth; b.classList.add("shake"); toast("Cierre bloqueado por mantenimiento (LOTO). Firma el CRS para abrir el hangar."); };
  root.addEventListener("click",e=>{ if(e.target===root) $("#fh-loto",root).click(); });
}
function toast(m){ const t=$("#fh-toast",root); if(!t) return; t.textContent=m; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),2800); }
function note(m){   // aviso suelto en la web, ya sin el hangar
  let n=$("#fh-note"); if(!n){ n=document.createElement("div"); n.id="fh-note"; n.setAttribute("role","status"); n.style.cssText="position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483000;background:#0b1218;color:#E9EFF3;border:1px solid #FFB52E;border-radius:8px;padding:12px 18px;max-width:min(92vw,520px);font:500 15px/1.4 system-ui,sans-serif;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.4)"; document.body.appendChild(n); }
  n.textContent=m; n.hidden=false; clearTimeout(n._t); n._t=setTimeout(()=>{ n.hidden=true; },7000);
}
function keys(e){
  if(!root||root.hidden) return;
  if(e.key==="Escape"){ e.preventDefault(); $("#fh-loto",root).click(); return; }
  if(e.key!=="Tab") return;
  const f=[...root.querySelectorAll("button:not([disabled])")].filter(x=>x.offsetParent!==null); if(!f.length) return;
  const a=document.activeElement, i=f.indexOf(a);
  if(!root.contains(a)){ e.preventDefault(); f[0].focus(); }
  else if(e.shiftKey&&i<=0){ e.preventDefault(); f[f.length-1].focus(); }
  else if(!e.shiftKey&&i===f.length-1){ e.preventDefault(); f[0].focus(); }
}
addEventListener("keydown",keys);

/* ---------------- preguntas ---------------- */
function loadSeen(){ try{ return new Set(JSON.parse(LS.get(K.seen(S.ed))||"[]")); }catch(e){ return new Set(); } }
function saveSeen(){ if(!S.preview) LS.set(K.seen(S.ed),JSON.stringify([...S.seen])); }
function drawSet(){
  return SUBJ.map(s=>{
    const idx=QS.map((q,i)=>i).filter(i=>QS[i][0]===s);
    let fresh=idx.filter(i=>!S.seen.has(i));
    if(!fresh.length){ idx.forEach(i=>S.seen.delete(i)); fresh=idx; }          // se acabaron las nuevas de esa asignatura: se reciclan
    const i=fresh[Math.floor(Math.random()*fresh.length)]; S.seen.add(i);
    const q=QS[i], opts=shuffle([q[2],q[3],q[4],q[5]].map((t,k)=>({t,ok:k===0})));
    return {s, q:q[1], why:q[6], opts};
  });
}

/* ---------------- pantallas ---------------- */
function setTest(on){ sheet.classList.toggle("testing",on); scene.setAttribute("viewBox",on?(innerWidth<600?"190 110 620 220":"0 110 960 220"):"0 0 960 380"); scene.setAttribute("preserveAspectRatio",on?"xMidYMid slice":"xMidYMid meet"); }
function crew(state,after){ clearTimeout(crewT); scene.setAttribute("data-crew",state); if(after) crewT=setTimeout(()=>scene.setAttribute("data-crew",after.to),after.ms); }
function bar(){ return S.preview&&S.bar?`<div class="prevbar"><span>MODO PRUEBA · nada se guarda</span><button type="button" id="fh-exit">Salir de la prueba</button></div>`:""; }
function bindExit(){ const b=$("#fh-exit",root); if(b) b.onclick=()=>hide(); }
function intro(){
  panel.innerHTML=`${bar()}
   <div class="tagrow"><span class="aog">AOG · AIRCRAFT ON GROUND</span><span class="mono">Tecnam P2006T · EC-ATP · WO-0075 · Hangar 3</span></div>
   <h3 id="fh-lt">La web está en el hangar</h3>
   <p>Revisión previa a los exámenes de Fase 0. Se ha abierto el capó, se han levantado los gatos y hay dos mecánicos dentro del motor. Nadie despega hasta que el ingeniero firme el certificado de puesta en servicio (CRS).</p>
   <div class="wo">
    <div><b>Defecto reportado</b><span>Exámenes Fase 0 · 17 y 19 de noviembre</span></div>
    <div><b>Acción correctiva</b><span>9 preguntas, una por asignatura</span></div>
    <div><b>Para firmar el CRS</b><span>${NEED} de ${TOTAL} correctas (75 %)</span></div>
   </div>
   <button class="btn" id="fh-go" type="button">Iniciar inspección</button>
   <p class="mono" style="margin:14px 0 0">Mantenimiento programado: dura lo que tardes en acertar ${NEED}. Tus datos y tu progreso están a salvo.</p>`;
  bindExit(); $("#fh-go",root).onclick=start; $("#fh-go",root).focus({preventScroll:true});
}
function start(){
  S.attempts++; setTest(true); crew("go",{ms:3500,to:"aside"});
  S.draw=drawSet(); saveSeen(); S.ans=Array(TOTAL).fill(null); S.idx=0; render();
}
function bays(done){ return `<div class="bays" aria-hidden="true">${SUBJ.map((s,i)=>`<div class="bay ${done?(S.draw[i].opts[S.ans[i]]&&S.draw[i].opts[S.ans[i]].ok?"good":"bad"):(i===S.idx?"cur":(S.ans[i]!==null?"done":""))}">${s}</div>`).join("")}</div>`; }
function render(){
  const d=S.draw[S.idx], last=S.idx===TOTAL-1;
  panel.innerHTML=`${bar()}<div class="tagrow"><span class="mono">Inspección ${S.attempts} · punto ${S.idx+1} de ${TOTAL}</span></div>
   ${bays(false)}
   <div class="qcard"><div class="mono">${d.s} · ${esc(NAME[d.s])}</div><div class="q" id="fh-lt">${esc(d.q)}</div>
    <div role="radiogroup" aria-label="Respuestas">${d.opts.map((o,i)=>`<button type="button" class="opt" role="radio" aria-checked="${S.ans[S.idx]===i}" data-i="${i}"><i>${"ABCD"[i]}</i><span>${esc(o.t)}</span></button>`).join("")}</div></div>
   <div class="nav"><button class="btn ghost" id="fh-prev" type="button" ${S.idx?"":"disabled"}>Anterior</button><button class="btn" id="fh-next" type="button" ${S.ans[S.idx]===null?"disabled":""}>${last?"Firmar CRS":"Siguiente"}</button></div>`;
  bindExit();
  panel.querySelectorAll(".opt").forEach(b=>b.onclick=()=>{ S.ans[S.idx]=+b.dataset.i; render(); const c=panel.querySelector(".opt[aria-checked=true]"); if(c) c.focus({preventScroll:true}); });
  $("#fh-prev",root).onclick=()=>{ if(S.idx>0){ S.idx--; render(); } };
  $("#fh-next",root).onclick=()=>{ if(S.ans[S.idx]===null) return; if(last) finish(); else { S.idx++; render(); } };
}
function finish(){
  setTest(false);
  const ok=S.draw.map((d,i)=>d.opts[S.ans[i]].ok), n=ok.filter(Boolean).length, pass=n>=NEED;
  if(pass){
    crew("aside"); scene.classList.remove("out"); void scene.getBoundingClientRect(); scene.classList.add("out");
    panel.innerHTML=`${bar()}<div class="tagrow"><span class="aog ok">RELEASED TO SERVICE</span><span class="mono">CRS firmado · WO-0075 cerrada</span></div>
     <div class="res"><div class="score ok">${n}/${TOTAL}</div><div class="stamp">CRS FIRMADO</div></div>
     <h3 id="fh-lt">Aeronave liberada</h3>
     <p>Se abren las puertas del hangar y el tractor remolca el avión hacia la pista. La web vuelve a estar en servicio y no volverá a salir.</p>
     ${bays(true)}<button class="btn" id="fh-enter" type="button">Salir del hangar</button>`;
    bindExit(); $("#fh-enter",root).onclick=free; $("#fh-enter",root).focus({preventScroll:true});
  }else{
    crew("back",{ms:3500,to:"work"});
    const bad=S.draw.map((d,i)=>({d,i})).filter(x=>!ok[x.i]);
    panel.innerHTML=`${bar()}<div class="tagrow"><span class="aog">CRS RECHAZADO</span><span class="mono">Defectos abiertos: ${bad.length}</span></div>
     <div class="res"><div class="score bad">${n}/${TOTAL}</div><div class="stamp bad">NO LIBERADO</div></div>
     <h3 id="fh-lt">Faltan ${NEED-n} para firmar</h3>
     <p>Hacen falta ${NEED} de ${TOTAL}. Los mecánicos vuelven al avión. Estos son los defectos abiertos; la próxima inspección trae 9 preguntas distintas.</p>
     ${bays(true)}
     <div class="defects">${bad.map(x=>`<div class="defect"><small>${x.d.s} · ${esc(NAME[x.d.s])}</small>${esc(x.d.q)}<br><span>Tu respuesta: ${esc(x.d.opts[S.ans[x.i]].t)}</span><br><em>Correcta: ${esc(x.d.opts.find(o=>o.ok).t)}</em>${x.d.why?`<span class="why">${esc(x.d.why)}</span>`:""}</div>`).join("")}</div>
     <button class="btn" id="fh-again" type="button">Nueva inspección</button>`;
    bindExit(); $("#fh-again",root).onclick=start; $("#fh-again",root).focus({preventScroll:true});
  }
  root.scrollTo({top:0,behavior:"smooth"});
}

/* ---------------- mostrar / ocultar ---------------- */
function inertOthers(on){
  if(on){ inerted=[]; [...document.body.children].forEach(el=>{ if(el!==root&&el.id!=="fh-note"&&!el.hasAttribute("data-fh-keep")&&!el.inert){ el.inert=true; inerted.push(el); } }); }
  else { inerted.forEach(el=>{ el.inert=false; }); inerted=[]; }
}
function show(o){
  o=o||{}; build();
  S.ed=o.ed||"demo"; S.preview=!!o.preview; S.bar=o.bar!==false; S.onFree=o.onFree||null; S.attempts=0; S.live=!o.preview;
  S.seen=S.preview?new Set():loadSeen();
  clearTimeout(crewT); scene.classList.remove("out"); scene.setAttribute("data-crew","work"); setTest(false);
  root.hidden=false; inertOthers(true); intro(); root.scrollTo(0,0);
}
function hide(){ if(!root||root.hidden) return; root.hidden=true; inertOthers(false); clearTimeout(crewT); }
function free(){
  const live=S.live&&!S.preview, ed=S.ed, cb=S.onFree;
  if(live){ LS.set(K.ok(ed),"1"); try{ if(DEP.sb&&DEP.user) DEP.sb.from("hangar_done").upsert({user_id:DEP.user.id,ed}).then(()=>{},()=>{}); }catch(e){} }
  hide(); if(live) note("Hangar liberado: la web vuelve a estar en servicio. Mucha suerte en los exámenes del 17 y el 19."); if(cb) try{ cb(); }catch(e){}
}

/* ---------------- activación (web con cuenta) ---------------- */
async function fetchFlag(){
  try{ const r=await DEP.sb.from("site_flags").select("value").eq("key","hangar").maybeSingle(); if(r.error||!r.data||!r.data.value) return null; const v=r.data.value; return {on:!!v.on,ed:String(v.ed||"")}; }catch(e){ return null; }
}
async function refresh(){
  if(!DEP.sb||!DEP.user) return;
  const f=await fetchFlag(); if(!f) return; flag=f;
  if(!f.ed) return;
  if(!f.on){ if(root&&!root.hidden&&S.live) hide(); return; }                       // apagado por el admin: se libera a todos
  if(LS.get(K.ok(f.ed))!=="1" && !DEP.admin){
    try{ const r=await DEP.sb.from("hangar_done").select("ed").eq("user_id",DEP.user.id).eq("ed",f.ed).maybeSingle(); if(r.data){ LS.set(K.ok(f.ed),"1"); if(root&&!root.hidden&&S.live) hide(); } }catch(e){}
  }
}
function tick(){
  if(DEP.admin||!flag||!flag.on||!flag.ed) return;
  const ed=flag.ed; if(LS.get(K.ok(ed))==="1") return;
  if(root&&!root.hidden) return;
  if(LS.get(K.trig(ed))==="1"){ show({ed}); return; }                                // ya le había saltado y no lo firmó: vuelve a salir al recargar
  if(document.visibilityState!=="visible") return;
  const now=Date.now(); if(now-(+LS.get(K.last)||0)<800) return; LS.set(K.last,now);   // varias pestañas no suman a la vez
  if(!secs||started!==ed){ secs=+LS.get(K.t(ed))||0; started=ed; }
  secs++; if(secs%5===0) LS.set(K.t(ed),secs);
  if(secs>=LIMIT){ LS.set(K.t(ed),secs); LS.set(K.trig(ed),"1"); show({ed}); }
}
function init(d){
  DEP=Object.assign({sb:null,user:null,admin:false},d||{}); stop(true);
  if(!DEP.sb||!DEP.user) return;
  refresh().then(tick);
  timer=setInterval(tick,1000); poll=setInterval(refresh,60000);
  document.addEventListener("visibilitychange",onVis);
}
function onVis(){ if(document.visibilityState==="visible") refresh(); else if(flag&&flag.ed&&secs) LS.set(K.t(flag.ed),secs); }
function stop(keepDep){ clearInterval(timer); clearInterval(poll); timer=poll=0; secs=0; started=false; document.removeEventListener("visibilitychange",onVis); if(root&&!root.hidden&&S.live) hide(); if(!keepDep){ DEP={sb:null,user:null,admin:false}; flag=null; } }

/* ---------------- admin ---------------- */
async function adminGet(){
  const r=await DEP.sb.rpc("hangar_stats"); if(r.error) throw r.error; return r.data||{on:false,ed:"",done:0};
}
async function adminSet(on,newEd){
  const r=await DEP.sb.rpc("set_hangar",{p_on:!!on,p_new:!!newEd}); if(r.error) throw r.error; flag={on:!!r.data.on,ed:String(r.data.ed||"")}; return r.data;
}
function preview(){ show({ed:"preview",preview:true,bar:true}); }

/* ---------------- para la muestra ---------------- */
function sim(correct){
  if(!root||root.hidden) show({ed:"demo",preview:true,bar:false}); start();
  const keep=shuffle([...Array(TOTAL).keys()]).slice(0,correct);
  S.draw.forEach((d,i)=>{ S.ans[i]=keep.includes(i)?d.opts.findIndex(o=>o.ok):d.opts.findIndex(o=>!o.ok); }); finish();
}
window.F0Hangar={ init, stop, preview, adminGet, adminSet, show, hide, _sim:sim, _size:()=>QS.length, _flag:()=>flag };
})();
