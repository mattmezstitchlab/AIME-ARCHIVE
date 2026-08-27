import React, { useMemo, useState } from 'react';

const TYPE_LABELS = {
  person: 'PERSONNE',
  group: 'GROUPE',
  table: 'TABLE',
  resource: 'RESSOURCE',
  event: 'ÉVÉNEMENT',
};

const STATUS_LABELS = {
  CONFIRMED: 'Confirmé',
  PENDING: 'En attente',
  MAYBE: 'Peut-être',
  DECLINED: 'Absent',
};

function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join('').toUpperCase() || '•';
}

function nodeKind(entity) {
  return entity?.entity_type || 'entity';
}

function stableAngle(index, total, offset = -Math.PI / 2) {
  return offset + (index / Math.max(total, 1)) * Math.PI * 2;
}

export default function NexusConstellation({ data = {} }) {
  const entities = data.entities || [];
  const relations = data.relations || [];
  const world = data.world || null;
  const [selectedId, setSelectedId] = useState(null);
  const [focus, setFocus] = useState('all');

  const people = useMemo(() => entities.filter((e) => e.entity_type === 'person'), [entities]);
  const others = useMemo(() => entities.filter((e) => e.entity_type !== 'person'), [entities]);
  const visiblePeople = focus === 'people' || focus === 'all' ? people : [];
  const visibleOthers = focus === 'people' ? [] : others;
  const visibleIds = new Set([...visiblePeople, ...visibleOthers].map((e) => e.id));
  const byId = useMemo(() => Object.fromEntries(entities.map((e) => [e.id, e])), [entities]);

  const positions = useMemo(() => {
    const result = {};
    const radius = 35;
    visiblePeople.forEach((entity, index) => {
      const a = stableAngle(index, visiblePeople.length);
      result[entity.id] = { x: 50 + Math.cos(a) * radius, y: 50 + Math.sin(a) * radius };
    });
    visibleOthers.forEach((entity, index) => {
      const a = stableAngle(index, visibleOthers.length, Math.PI / 4);
      result[entity.id] = { x: 50 + Math.cos(a) * 27, y: 50 + Math.sin(a) * 27 };
    });
    return result;
  }, [visiblePeople, visibleOthers]);

  const visibleRelations = relations.filter((r) => visibleIds.has(r.from_entity_id) && visibleIds.has(r.to_entity_id));
  const selected = selectedId ? byId[selectedId] : null;

  return (
    <section className="nexus-shell" aria-label="NEXUS constellation">
      <div className="nexus-toolbar">
        <div>
          <span className="nexus-kicker">NEXUS / WORLD MODEL</span>
          <h1>{world?.name || 'Univers GAÏA'}</h1>
          <p>Le monde comme un réseau vivant. Les personnes orbitent, les relations expliquent, GAÏA maintient l'équilibre.</p>
        </div>
        <div className="nexus-filters" role="group" aria-label="Filtre de constellation">
          {['all', 'people'].map((value) => (
            <button key={value} className={focus === value ? 'active' : ''} onClick={() => setFocus(value)}>
              {value === 'all' ? 'Monde' : 'Personnes'}
            </button>
          ))}
        </div>
      </div>

      <div className="nexus-stage">
        <svg className="nexus-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <filter id="nexusGlow"><feGaussianBlur stdDeviation="0.45" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
          </defs>
          {visibleRelations.map((relation) => {
            const a = positions[relation.from_entity_id];
            const b = positions[relation.to_entity_id];
            if (!a || !b) return null;
            const active = selectedId === relation.from_entity_id || selectedId === relation.to_entity_id;
            return <line key={relation.id} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className={`nexus-link ${active ? 'is-active' : ''}`} filter={active ? 'url(#nexusGlow)' : undefined} />;
          })}
          {[...visiblePeople].map((entity) => {
            const p = positions[entity.id];
            return <line key={`core-${entity.id}`} x1="50" y1="50" x2={p.x} y2={p.y} className={`nexus-core-link ${selectedId === entity.id ? 'is-active' : ''}`} />;
          })}
        </svg>

        <div className="nexus-orbit orbit-one" />
        <div className="nexus-orbit orbit-two" />
        <div className="nexus-core" aria-label="GAÏA world engine">
          <div className="nexus-cube">
            <span className="cube-face cube-front">GAÏA</span>
            <span className="cube-face cube-back">WORLD</span>
            <span className="cube-face cube-right">TIME</span>
            <span className="cube-face cube-left">PEOPLE</span>
            <span className="cube-face cube-top">STATE</span>
            <span className="cube-face cube-bottom">LINKS</span>
          </div>
          <div className="nexus-core-label">WORLD ENGINE</div>
          <div className="nexus-health"><span /> {world?.health?.score ?? '—'} / 100</div>
        </div>

        {visiblePeople.map((entity) => {
          const p = positions[entity.id];
          const active = selectedId === entity.id;
          const status = entity.rsvp_status || entity.status;
          return (
            <button key={entity.id} className={`nexus-node person-node ${active ? 'selected' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setSelectedId(active ? null : entity.id)} aria-label={`Sélectionner ${entity.name}`}>
              <span className="nexus-avatar">{entity.avatar_url ? <img src={entity.avatar_url} alt="" /> : initials(entity.name)}</span>
              <span className="nexus-node-name">{entity.name}</span>
              {status && <span className="nexus-node-status">{STATUS_LABELS[status] || status}</span>}
            </button>
          );
        })}

        {visibleOthers.map((entity) => {
          const p = positions[entity.id];
          const active = selectedId === entity.id;
          return (
            <button key={entity.id} className={`nexus-node secondary-node ${active ? 'selected' : ''}`} style={{ left: `${p.x}%`, top: `${p.y}%` }} onClick={() => setSelectedId(active ? null : entity.id)}>
              <span className="nexus-secondary-dot">{initials(entity.name)}</span>
              <span className="nexus-node-name">{entity.name}</span>
              <span className="nexus-node-status">{TYPE_LABELS[nodeKind(entity)] || 'ENTITÉ'}</span>
            </button>
          );
        })}

        <div className="nexus-empty-hint">
          <span>{visiblePeople.length + visibleOthers.length}</span> entités · <span>{visibleRelations.length}</span> relations
        </div>
      </div>

      <aside className={`nexus-inspector ${selected ? 'open' : ''}`} aria-live="polite">
        {selected ? (
          <>
            <button className="nexus-close" onClick={() => setSelectedId(null)} aria-label="Fermer">×</button>
            <span className="nexus-kicker">{TYPE_LABELS[nodeKind(selected)] || 'ENTITÉ'}</span>
            <h2>{selected.name}</h2>
            <p>{selected.role || selected.description || 'Entité du World Model.'}</p>
            <div className="nexus-inspector-grid">
              <span>Relations</span><strong>{relations.filter((r) => r.from_entity_id === selected.id || r.to_entity_id === selected.id).length}</strong>
              <span>État</span><strong>{STATUS_LABELS[selected.rsvp_status] || selected.status || 'Actif'}</strong>
            </div>
          </>
        ) : (
          <><span className="nexus-kicker">NEXUS</span><strong>Sélectionnez une orbite</strong><p>Les détails apparaissent ici sans quitter la constellation.</p></>
        )}
      </aside>
    </section>
  );
}
