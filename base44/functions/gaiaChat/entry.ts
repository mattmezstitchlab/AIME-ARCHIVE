import { createClientFromRequest } from 'npm:@base44/sdk@0.8.40';

export default async function(req: Request): Promise<Response> {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.json();
    const message = typeof body.message === 'string' ? body.message.slice(0, 600).trim() : '';
    if (!message) {
      return Response.json({ error: 'Message requis' }, { status: 400 });
    }
    const world = body.world && typeof body.world === 'object' ? body.world : {};
    const blocks = Array.isArray(body.blocks) ? body.blocks.slice(0, 60) : [];
    const entities = Array.isArray(body.entities) ? body.entities.slice(0, 60) : [];
    const constraints = Array.isArray(body.constraints) ? body.constraints.slice(0, 60) : [];
    const people = Array.isArray(body.people) ? body.people.slice(0, 80) : [];
    const tables = Array.isArray(body.tables) ? body.tables.slice(0, 30) : [];

    const prompt = `Tu es GAÏA, l'orchestrateur intelligent d'un mariage (Wedding Universe Engine).
Tu réponds en français, avec précision et élégance, UNIQUEMENT à partir des données réelles fournies ci-dessous.
Tu ne dois JAMAIS inventer une donnée. Si une information est inconnue, dis-le clairement ("Information inconnue").

DONNÉES DU MARIAGE (source de vérité) :
Univers : ${JSON.stringify(world)}
Entités : ${JSON.stringify(entities)}
Blocs horaires (TimeBlocks) : ${JSON.stringify(blocks)}
Contraintes : ${JSON.stringify(constraints)}
Personnes (People Graph) : ${JSON.stringify(people)}
Tables : ${JSON.stringify(tables)}

MESSAGE DE L'UTILISATEUR : "${message}"

TON RÔLE EST STRICTEMENT L'INTERPRÉTATION DU LANGAGE.
Tu ne décides jamais d'une conséquence : le moteur causal déterministe calcule seul les impacts, conflits et blocages.
Si une information n'existe pas dans les données, réponds "Je ne possède pas cette information" et propose d'ajouter la contrainte manquante — n'invente jamais.

RÈGLES :
1. Si l'utilisateur demande de décaler, changer ou simuler un horaire (ex: "et si le photographe arrivait à 15h ?"), réponds avec intent="simulate_time_change", block_id = l'id EXACT du TimeBlock concerné, et new_start au format HH:mm. Dans reply, annonce que tu lances l'analyse d'impact — n'énonce AUCUN impact, aucune conséquence, aucun conflit.
2. Si l'utilisateur annonce une participation (ex: "Julie confirme", "cette personne est absente"), réponds avec intent="simulate_rsvp", person_id = l'id EXACT de la personne dans la liste Personnes, et rsvp_status parmi INVITED, PENDING, CONFIRMED, DECLINED, MAYBE.
3. Si l'utilisateur demande de placer quelqu'un à une table, réponds avec intent="simulate_table_assignment", person_id et table_id EXACTS.
4. Si la personne ou la table n'est pas identifiable avec certitude dans les données, intent="none" et réponds "Je ne possède pas cette information" en précisant ce qui manque. N'invente JAMAIS une personne.
5. Sinon, intent="none" et réponds à la question avec les données réelles (horaires, contraintes, statuts).
6. Ne modifie jamais rien directement : toute modification passe par un scénario que l'utilisateur devra confirmer.
7. Reste concis (moins de 120 mots).`;

    const result = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: 'object',
        properties: {
          reply: { type: 'string' },
          intent: { type: 'string', enum: ['none', 'simulate_time_change', 'simulate_rsvp', 'simulate_table_assignment'] },
          block_id: { type: 'string' },
          new_start: { type: 'string' },
          person_id: { type: 'string' },
          rsvp_status: { type: 'string' },
          table_id: { type: 'string' },
        },
        required: ['reply', 'intent'],
      },
    });

    return Response.json(result);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}