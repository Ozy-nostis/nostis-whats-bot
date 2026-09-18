// src/data/keywords.ts

export interface KeywordResponse {
  keywords: string[]; // Palavras que ativam a resposta
  responses: string[]; // Lista de respostas possíveis
}

// Onde é definido a mensagem recebida e a resposta
export const KEYWORD_RESPONSES: KeywordResponse[] = [
  {
    keywords: ["uber on", "Alguém on", "alguem on", "on?"],
    responses: [
      "On, chama pv 🚗",
      "Chama pv 🚗"
    ],
  },
];