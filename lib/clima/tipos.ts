/** Uma hora de clima, em hora local da obra ("YYYY-MM-DDTHH:00"). */
export type HoraClima = { hora: string; temperatura: number; chuva_mm: number; codigo: number };

/** Clima registrado para um turno: resumo + leituras de 2 em 2h. */
export type ClimaTurno = {
  temp_media: number;
  temp_max: number;
  temp_min: number;
  chuva_mm: number;
  choveu: boolean;
  leituras: HoraClima[];
};

/** Janela do turno em hora local ("YYYY-MM-DDTHH:MM"). */
export type JanelaClima = { inicio: string; fim: string };

export type Cidade = { nome: string; latitude: number; longitude: number };
