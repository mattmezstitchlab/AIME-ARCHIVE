// Le langage visuel de GAÏA : un monde est fait de visages.
export const CAST = [
  { id: 'mariee', name: 'Camille', role: 'Mariée', photo: 'https://randomuser.me/api/portraits/women/44.jpg' },
  { id: 'marie', name: 'Antoine', role: 'Marié', photo: 'https://randomuser.me/api/portraits/men/32.jpg' },
  { id: 'photographe', name: 'Studio Lumière', role: 'Photographe', photo: 'https://randomuser.me/api/portraits/men/75.jpg' },
  { id: 'fleuriste', name: 'Atelier Flore', role: 'Fleuriste', photo: 'https://randomuser.me/api/portraits/women/68.jpg' },
  { id: 'traiteur', name: 'Maison Terroir', role: 'Traiteur', photo: 'https://randomuser.me/api/portraits/men/18.jpg' },
  { id: 'musicien', name: 'Quatuor Nord', role: 'Musicien', photo: 'https://randomuser.me/api/portraits/women/26.jpg' },
  { id: 'temoin', name: 'Sarah', role: 'Témoin', photo: 'https://randomuser.me/api/portraits/women/9.jpg' },
  { id: 'lieu', name: 'Domaine des Sources', role: 'Lieu', photo: 'https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=200&q=70&auto=format&fit=crop' },
];

export const byId = (id) => CAST.find((c) => c.id === id);