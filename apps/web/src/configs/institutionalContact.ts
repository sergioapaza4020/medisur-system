export interface InstitutionalContact {
  address?: string;
  phone?: string;
  email?: string;
  hours?: string;
  // Official directions link only. Never infer coordinates or embed a guessed location.
  mapsUrl?: string;
  mapsEmbedUrl?: string;
}

// Populate only with institutionally approved public contact information.
export const institutionalContact: InstitutionalContact = {
  address: 'Av. Murillo Nro. 77',
  phone: '62-45655',
  mapsUrl: 'https://maps.app.goo.gl/zw1hVJUyy7e5hBHh6',
  // Embed obtained from the Share > Embed map dialog of the institution's supplied link.
  mapsEmbedUrl:
    'https://www.google.com/maps/embed?pb=!1m14!1m8!1m3!1d469.9076050333792!2d-65.7664393!3d-19.5733227!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x93f94d007042bba1%3A0x892bbdb956cedd30!2sCentro%20de%20especialidades%20m%C3%A9dicas%20MEDI%20SUR!5e0!3m2!1ses-419!2sbo!4v1792041956001!5m2!1ses-419!2sbo',
};
