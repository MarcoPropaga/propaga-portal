/* Catálogo B&M Log v1.0 (01/10/2026) — vigente, contrato assinado.
   referencia = valor de referência (USO INTERNO, nunca enviado ao cliente).
   Preço B&M = referencia × 0,85 (src/lib/precos.ts). null = a cotar. */
import type { Catalogo } from "@/lib/tipos";

export const catalogoBmlogV1: Catalogo = {
  "clienteId": "bmlog",
  "versao": "1.0",
  "data": "2026-10-01",
  "status": "vigente",
  "categorias": [
    {
      "id": "rs",
      "nome": "Redes sociais"
    },
    {
      "id": "dg",
      "nome": "Digital, WhatsApp e e-mail"
    },
    {
      "id": "ap",
      "nome": "Apresentações e institucional"
    },
    {
      "id": "vd",
      "nome": "Vídeos e TV"
    },
    {
      "id": "im",
      "nome": "Impressos"
    },
    {
      "id": "br",
      "nome": "Brindes"
    },
    {
      "id": "ev",
      "nome": "Eventos e feiras"
    },
    {
      "id": "rh",
      "nome": "RH e comunicação interna"
    },
    {
      "id": "cp",
      "nome": "Campanhas"
    },
    {
      "id": "lg",
      "nome": "Soluções para logística"
    }
  ],
  "servicos": [
    {
      "cod": "01",
      "categoria": "rs",
      "nome": "Post estático",
      "descricao": "Uma mensagem visual para publicação no feed ou nos Stories.",
      "escopo": "Uma peça em um formato. Entrega em JPG ou PNG.",
      "opcao": {
        "k": "Formato",
        "o": [
          "1:1",
          "4:5",
          "9:16"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 200
        },
        {
          "rotulo": "Edição de layout existente",
          "modalidade": "edicao",
          "referencia": 100
        }
      ]
    },
    {
      "cod": "02",
      "categoria": "rs",
      "nome": "Post carrossel/sequencial",
      "descricao": "Sequência com capa, desenvolvimento e encerramento.",
      "escopo": "Uma publicação de até 5 telas, formato uniforme.",
      "opcao": {
        "k": "Formato",
        "o": [
          "1:1",
          "4:5"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 5 telas",
          "modalidade": "novo",
          "referencia": 350
        },
        {
          "rotulo": "Novo, 6 a 10 telas",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Atualização",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "03",
      "categoria": "rs",
      "nome": "Post comemorativo/data",
      "descricao": "Peça para uma data, aniversário ou celebração.",
      "escopo": "Uma peça por ocasião, em um formato.",
      "opcao": {
        "k": "Formato",
        "o": [
          "1:1",
          "4:5",
          "9:16"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "Atualização em modelo aprovado",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "04",
      "categoria": "rs",
      "nome": "Post conceito/campanha",
      "descricao": "Mensagem central e linguagem visual de uma ação.",
      "escopo": "Uma peça principal com conceito. Desdobramentos não incluídos.",
      "opcao": {
        "k": "Formato",
        "o": [
          "1:1",
          "4:5",
          "9:16"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 500
        },
        {
          "rotulo": "Adaptações ou novas mensagens",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "05",
      "categoria": "rs",
      "nome": "Post + vídeo/motion simples",
      "descricao": "Post estático e vídeo derivados do mesmo conceito.",
      "escopo": "Kit: 1 post em 1:1 ou 4:5 e 1 motion. Captação presencial excluída.",
      "opcao": {
        "k": "Formato",
        "o": [
          "9:16 vertical",
          "1:1 quadrado",
          "16:9 horizontal"
        ]
      },
      "video": true,
      "variantes": [
        {
          "rotulo": "Novo, kit até 15 s",
          "modalidade": "novo",
          "referencia": 750
        },
        {
          "rotulo": "Novo, kit 16 a 30 s",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Novo, kit 31 a 60 s",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "07",
      "categoria": "rs",
      "nome": "Capa de redes sociais",
      "descricao": "Capa de um perfil ou página, com recortes e áreas seguras.",
      "escopo": "Uma capa por rede. Entrega em JPG ou PNG.",
      "opcao": {
        "k": "Rede",
        "o": [
          "Instagram",
          "Facebook",
          "LinkedIn",
          "YouTube"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "Atualização ou conjunto de redes",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "08",
      "categoria": "dg",
      "nome": "WhatsApp Card",
      "descricao": "Card para comunicado, convite ou divulgação comercial.",
      "escopo": "Um card em um formato; 9:16 para Status como adaptação.",
      "opcao": {
        "k": "Formato",
        "o": [
          "1:1",
          "4:5",
          "9:16"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 200
        },
        {
          "rotulo": "Edição ou adaptação adicional",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "09",
      "categoria": "dg",
      "nome": "Capa WhatsApp",
      "descricao": "Arte para o campo de capa do ambiente utilizado.",
      "escopo": "Uma capa. Não confundir com foto de perfil, card ou Status.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 200
        },
        {
          "rotulo": "Atualização",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "10",
      "categoria": "dg",
      "nome": "E-mail marketing",
      "descricao": "Layout de cabeçalho, conteúdo, chamada para ação e rodapé.",
      "escopo": "Um e-mail visual. Não inclui HTML, disparo, automação ou base.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 5 blocos",
          "modalidade": "novo",
          "referencia": 450
        },
        {
          "rotulo": "Edição, até 5 blocos",
          "modalidade": "edicao",
          "referencia": 200
        },
        {
          "rotulo": "6 a 10 blocos ou HTML responsivo",
          "modalidade": "novo",
          "referencia": null
        }
      ]
    },
    {
      "cod": "11",
      "categoria": "dg",
      "nome": "Assinatura de e-mail",
      "descricao": "Identificação com nome, cargo, contatos e marca.",
      "escopo": "Modelo HTML simples para até 3 pessoas, testado em 2 ambientes.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, modelo HTML",
          "modalidade": "novo",
          "referencia": 300
        },
        {
          "rotulo": "Pessoas extras ou instalação",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "12",
      "categoria": "dg",
      "nome": "Banner para site",
      "descricao": "Peça estática para uma área definida do site.",
      "escopo": "Um banner em uma dimensão. Implantação no site não incluída.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, 1 dimensão",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "Mobile, animação ou atualização",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "13",
      "categoria": "dg",
      "nome": "Post + banner site",
      "descricao": "Duas aplicações de uma mesma mensagem.",
      "escopo": "Kit: 1 post e 1 banner no tamanho do site.",
      "opcao": {
        "k": "Formato",
        "o": [
          "1:1",
          "4:5"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, kit de 2 peças",
          "modalidade": "novo",
          "referencia": 350
        },
        {
          "rotulo": "Versões adicionais",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "14",
      "categoria": "dg",
      "nome": "Impresso + E-mail + WhatsApp",
      "descricao": "Um conceito adaptado para três canais.",
      "escopo": "Kit: impresso até 2 faces, e-mail até 5 blocos e 1 card.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, kit de 3 layouts",
          "modalidade": "novo",
          "referencia": 700
        },
        {
          "rotulo": "HTML ou peças extras",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "15",
      "categoria": "ap",
      "nome": "Apresentação comercial",
      "descricao": "Serviços, diferenciais e proposta de valor, com conteúdo fornecido.",
      "escopo": "Slides em 16:9. Entrega em PDF e editável acordado.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 10 slides",
          "modalidade": "novo",
          "referencia": 1200
        },
        {
          "rotulo": "Edição, até 5 slides alterados",
          "modalidade": "edicao",
          "referencia": 400
        },
        {
          "rotulo": "Novo, 11 a 20 slides",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Novo, acima de 20 slides",
          "modalidade": "novo",
          "referencia": null
        }
      ]
    },
    {
      "cod": "16",
      "categoria": "ap",
      "nome": "Apresentação para webinar",
      "descricao": "Apoio visual para palestra, treinamento ou transmissão.",
      "escopo": "Slides em 16:9. Transmissão e gravação excluídas.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 10 slides",
          "modalidade": "novo",
          "referencia": 1000
        },
        {
          "rotulo": "Novo, 11 a 20 slides",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Novo, 21 a 30 slides",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Novo, acima de 30 slides",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "17",
      "categoria": "ap",
      "nome": "Apresentação institucional",
      "descricao": "História, atuação, estrutura e serviços da empresa.",
      "escopo": "Slides em 16:9. A B&M Log aprova os dados.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 10 slides",
          "modalidade": "novo",
          "referencia": 1200
        },
        {
          "rotulo": "Novo, mais de 10 slides",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "18",
      "categoria": "ap",
      "nome": "PDF/apresentação",
      "descricao": "Documento diagramado para leitura e envio digital.",
      "escopo": "Páginas com links clicáveis quando previstos. Redação integral não incluída.",
      "opcao": {
        "k": "Formato",
        "o": [
          "A4 vertical",
          "A4 horizontal",
          "16:9"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 6 páginas",
          "modalidade": "novo",
          "referencia": 700
        },
        {
          "rotulo": "Novo, 7 a 12 páginas",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Novo, 13 a 20 páginas",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "19",
      "categoria": "vd",
      "nome": "Vídeo motion simples",
      "descricao": "Textos, imagens, transições e animação simples.",
      "escopo": "Um vídeo por faixa de duração final, MP4 Full HD. Filmagem excluída.",
      "opcao": {
        "k": "Formato",
        "o": [
          "9:16 vertical",
          "1:1 quadrado",
          "16:9 horizontal"
        ]
      },
      "video": true,
      "variantes": [
        {
          "rotulo": "Novo, até 15 s",
          "modalidade": "novo",
          "referencia": 600
        },
        {
          "rotulo": "Novo, 16 a 30 s",
          "modalidade": "novo",
          "referencia": 800
        },
        {
          "rotulo": "Novo, 31 a 60 s",
          "modalidade": "novo",
          "referencia": 1200
        },
        {
          "rotulo": "Edição, até 15 s",
          "modalidade": "edicao",
          "referencia": 200
        },
        {
          "rotulo": "Edição, 16 a 30 s",
          "modalidade": "edicao",
          "referencia": 300
        },
        {
          "rotulo": "Edição, 31 a 60 s",
          "modalidade": "edicao",
          "referencia": 450
        }
      ]
    },
    {
      "cod": "20",
      "categoria": "vd",
      "nome": "Vídeo institucional",
      "descricao": "Narrativa institucional com conceito, roteiro e montagem visual.",
      "escopo": "Um formato final em Full HD. Captação, fotografia e locução excluídas.",
      "opcao": {
        "k": "Formato",
        "o": [
          "16:9 horizontal",
          "Resolução da TV (informar)"
        ]
      },
      "video": true,
      "variantes": [
        {
          "rotulo": "Novo, até 60 s",
          "modalidade": "novo",
          "referencia": 1800
        },
        {
          "rotulo": "Novo, 61 a 120 s",
          "modalidade": "novo",
          "referencia": 2800
        },
        {
          "rotulo": "Novo, bloco adicional até 60 s",
          "modalidade": "novo",
          "referencia": 900
        },
        {
          "rotulo": "Edição, até 60 s",
          "modalidade": "edicao",
          "referencia": 700
        },
        {
          "rotulo": "Edição, 61 a 120 s",
          "modalidade": "edicao",
          "referencia": 1100
        },
        {
          "rotulo": "Edição, bloco adicional até 60 s",
          "modalidade": "edicao",
          "referencia": 400
        }
      ]
    },
    {
      "cod": "21",
      "categoria": "vd",
      "nome": "Vídeo para TV interna",
      "descricao": "Avisos, segurança e comunicação para as telas internas.",
      "escopo": "Um card ou vídeo. Plataforma e equipamentos excluídos.",
      "opcao": {
        "k": "Formato",
        "o": [
          "16:9 horizontal",
          "Resolução da TV (informar)"
        ]
      },
      "video": true,
      "variantes": [
        {
          "rotulo": "Novo, card estático",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "Novo, motion até 15 s",
          "modalidade": "novo",
          "referencia": 600
        },
        {
          "rotulo": "Novo, motion 16 a 30 s",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Novo, motion 31 a 60 s",
          "modalidade": "novo",
          "referencia": null
        }
      ]
    },
    {
      "cod": "22",
      "categoria": "vd",
      "nome": "TV + posts",
      "descricao": "Uma mensagem adaptada para TV e redes sociais.",
      "escopo": "Kit estático: 1 card TV 16:9 e 2 posts.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, kit estático",
          "modalidade": "novo",
          "referencia": 500
        },
        {
          "rotulo": "Versão com vídeo ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "23",
      "categoria": "vd",
      "nome": "TV + site + Canva",
      "descricao": "Adaptação de um conceito para três aplicações.",
      "escopo": "Kit: 1 card TV, 1 banner site e 1 template Canva editável.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, kit de 3 entregáveis",
          "modalidade": "novo",
          "referencia": 650
        },
        {
          "rotulo": "Versão animada ou atualização",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "24",
      "categoria": "im",
      "nome": "Flyer",
      "descricao": "Divulgação objetiva de serviço, evento ou ação.",
      "escopo": "Sem dobra. Impressão excluída.",
      "opcao": {
        "k": "Tamanho",
        "o": [
          "A6",
          "A5",
          "A4",
          "Personalizado (informar)"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, frente e verso",
          "modalidade": "novo",
          "referencia": 350
        },
        {
          "rotulo": "Uma face ou atualização",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "25",
      "categoria": "im",
      "nome": "Folder",
      "descricao": "Apresentação de serviços organizada em painéis.",
      "escopo": "Gabarito e compensação das dobras conforme a gráfica.",
      "opcao": {
        "k": "Tamanho fechado",
        "o": [
          "A5",
          "A4",
          "10 × 21 cm",
          "Personalizado (informar)"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 6 faces (2 dobras)",
          "modalidade": "novo",
          "referencia": 650
        },
        {
          "rotulo": "Novo, 4 faces (1 dobra)",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Novo, 8 faces (3 dobras)",
          "modalidade": "novo",
          "referencia": null
        },
        {
          "rotulo": "Edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "26",
      "categoria": "im",
      "nome": "Cartão de visita",
      "descricao": "Modelo de identificação profissional com contatos.",
      "escopo": "Frente e verso para 1 pessoa, conforme gabarito.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, modelo para 1 pessoa",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "Personalizações ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "27",
      "categoria": "im",
      "nome": "Cartão comemorativo",
      "descricao": "Mensagem de homenagem, agradecimento ou celebração.",
      "escopo": "Até 2 faces, sem dobra.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 2 faces",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "4 faces ou adaptação digital",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "28",
      "categoria": "im",
      "nome": "Cartão de Natal",
      "descricao": "Mensagem e composição natalinas.",
      "escopo": "Até 2 faces sem dobra; tamanho conforme envelope.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 2 faces",
          "modalidade": "novo",
          "referencia": 300
        },
        {
          "rotulo": "4 faces ou personalizações",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "29",
      "categoria": "im",
      "nome": "Porta-rascunho",
      "descricao": "Aplicação gráfica no suporte para folhas.",
      "escopo": "Uma arte conforme gabarito do fabricante. Fabricação excluída.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, 1 gabarito",
          "modalidade": "novo",
          "referencia": 300
        },
        {
          "rotulo": "Faces extras ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "30",
      "categoria": "im",
      "nome": "Tag",
      "descricao": "Identificação, mensagem de presente ou comunicação promocional.",
      "escopo": "Frente e verso, formato conforme fabricante.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, frente e verso",
          "modalidade": "novo",
          "referencia": 200
        },
        {
          "rotulo": "Modelos adicionais ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "31",
      "categoria": "im",
      "nome": "Selo",
      "descricao": "Elemento gráfico de aniversário, campanha ou identificação.",
      "escopo": "Um desenho. PNG transparente; vetor quando acordado.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "Adaptações ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "32",
      "categoria": "br",
      "nome": "Camiseta",
      "descricao": "Aplicação institucional ou estampa de campanha.",
      "escopo": "Arte para frente e costas de 1 modelo. Confecção excluída.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, frente e costas",
          "modalidade": "novo",
          "referencia": 300
        },
        {
          "rotulo": "Mangas ou variações",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "33",
      "categoria": "br",
      "nome": "Caneca",
      "descricao": "Arte institucional ou temática em gabarito de impressão.",
      "escopo": "Um modelo, conforme fornecedor.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "Personalização por nome",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "34",
      "categoria": "br",
      "nome": "Caderno",
      "descricao": "Projeto visual da capa e contracapa.",
      "escopo": "A5, A4 ou medida do fornecedor. Miolo é adicional.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, capa e contracapa",
          "modalidade": "novo",
          "referencia": 400
        },
        {
          "rotulo": "Miolo personalizado ou extras",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "35",
      "categoria": "br",
      "nome": "Calendário de mesa",
      "descricao": "Organização das datas e criação visual mensal.",
      "escopo": "13 lâminas: capa e 12 meses. Impressão e montagem excluídas.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, capa + 12 lâminas",
          "modalidade": "novo",
          "referencia": 1200
        },
        {
          "rotulo": "Lâmina anual ou versos",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "36",
      "categoria": "br",
      "nome": "Adesivo",
      "descricao": "Arte para identificação ou divulgação institucional.",
      "escopo": "Um modelo e uma dimensão, conforme gabarito.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 250
        },
        {
          "rotulo": "Variações ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "37",
      "categoria": "ev",
      "nome": "Stand/booth",
      "descricao": "Comunicação gráfica de um espaço de exposição.",
      "escopo": "Até 5 superfícies. Arquitetura, 3D, estrutura e montagem excluídas.",
      "opcao": null,
      "video": false,
      "nota": "Versão em outro idioma inclui tradução e revisão por profissional nativo, orçadas à parte.",
      "variantes": [
        {
          "rotulo": "Novo, até 5 superfícies",
          "modalidade": "novo",
          "referencia": 2000
        },
        {
          "rotulo": "Outras quantidades ou edição",
          "modalidade": "edicao",
          "referencia": null
        },
        {
          "rotulo": "Versão em outro idioma (feira internacional)",
          "modalidade": "novo",
          "referencia": null
        }
      ]
    },
    {
      "cod": "39",
      "categoria": "ev",
      "nome": "Visual de stand",
      "descricao": "Linguagem visual principal do espaço.",
      "escopo": "1 peça principal e até 2 adaptações.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 1200
        },
        {
          "rotulo": "Aplicações adicionais",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "40",
      "categoria": "ev",
      "nome": "Material para feira",
      "descricao": "Material para apresentar serviços no evento.",
      "escopo": "Referência: 1 flyer frente e verso.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, flyer frente e verso",
          "modalidade": "novo",
          "referencia": 350
        },
        {
          "rotulo": "Outros materiais ou kit",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "41",
      "categoria": "ev",
      "nome": "Banner",
      "descricao": "Comunicação física para exposição.",
      "escopo": "Uma arte em uma dimensão. Lona e impressão excluídas.",
      "opcao": {
        "k": "Orientação",
        "o": [
          "Horizontal",
          "Vertical"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 400
        },
        {
          "rotulo": "Variações ou atualização",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "42",
      "categoria": "ev",
      "nome": "Backdrop",
      "descricao": "Painel de fundo institucional, de marcas ou temático.",
      "escopo": "Uma arte em uma dimensão.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 600
        },
        {
          "rotulo": "Variações ou atualização",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "43",
      "categoria": "ev",
      "nome": "Mobile de teto",
      "descricao": "Peça suspensa de comunicação.",
      "escopo": "Uma arte de até 2 faces. Fabricação e instalação excluídas.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 2 faces",
          "modalidade": "novo",
          "referencia": 400
        },
        {
          "rotulo": "Conjunto de peças ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "44",
      "categoria": "rh",
      "nome": "Arte/comunicado RH",
      "descricao": "Aviso de benefícios, prazos, atividades ou orientações.",
      "escopo": "Uma peça em um formato.",
      "opcao": {
        "k": "Formato",
        "o": [
          "Digital",
          "A4 para mural",
          "TV 16:9"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 200
        },
        {
          "rotulo": "Atualização ou adaptações",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "45",
      "categoria": "rh",
      "nome": "Fundo de tela",
      "descricao": "Wallpaper institucional ou de campanha.",
      "escopo": "Uma arte em uma resolução.",
      "opcao": {
        "k": "Aplicação",
        "o": [
          "Computador",
          "Celular"
        ]
      },
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 200
        },
        {
          "rotulo": "Resoluções extras ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "46",
      "categoria": "rh",
      "nome": "Cartão de boas-vindas",
      "descricao": "Recepção de novo colaborador.",
      "escopo": "Um modelo e uma personalização, até 2 faces.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 200
        },
        {
          "rotulo": "4 faces ou pessoas extras",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "47",
      "categoria": "rh",
      "nome": "Comunicação interna",
      "descricao": "Mensagem organizada para canais internos.",
      "escopo": "Um comunicado com até 2 formatos. Distribuição não incluída.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 2 formatos",
          "modalidade": "novo",
          "referencia": 300
        },
        {
          "rotulo": "Edição ou formatos extras",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "48",
      "categoria": "rh",
      "nome": "Campanha interna/RH",
      "descricao": "Conceito e sequência de mensagens para uma ação de RH.",
      "escopo": "Conceito e 3 peças estáticas. Conteúdo validado pelo RH.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, conceito + 3 peças",
          "modalidade": "novo",
          "referencia": 1000
        },
        {
          "rotulo": "Kit ampliado ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "49",
      "categoria": "cp",
      "nome": "Campanha institucional",
      "descricao": "Posicionamento, serviços ou diferenciais.",
      "escopo": "Conceito, mensagem principal e 4 peças estáticas.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, conceito + 4 peças",
          "modalidade": "novo",
          "referencia": 1800
        },
        {
          "rotulo": "Vídeos, pesquisa ou ampliação",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "50",
      "categoria": "cp",
      "nome": "Campanha comemorativa",
      "descricao": "Aniversário, conquista ou marco institucional.",
      "escopo": "Conceito e 3 peças estáticas para uma ocasião.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, conceito + 3 peças",
          "modalidade": "novo",
          "referencia": 1000
        },
        {
          "rotulo": "Kit ampliado ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "51",
      "categoria": "cp",
      "nome": "Campanha de data especial",
      "descricao": "Ação relacionada a uma data específica.",
      "escopo": "Conceito e 2 peças estáticas.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, conceito + 2 peças",
          "modalidade": "novo",
          "referencia": 700
        },
        {
          "rotulo": "Peças adicionais ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "52",
      "categoria": "cp",
      "nome": "Campanha interna",
      "descricao": "Cultura, processos, reconhecimento ou segurança.",
      "escopo": "Conceito e 4 peças estáticas em canais internos.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, conceito + 4 peças",
          "modalidade": "novo",
          "referencia": 1200
        },
        {
          "rotulo": "Kit ampliado ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "53",
      "categoria": "cp",
      "nome": "Campanha promocional",
      "descricao": "Oferta ou ação comercial com período definido.",
      "escopo": "Conceito e 3 peças. A B&M Log informa condições e validade.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, conceito + 3 peças",
          "modalidade": "novo",
          "referencia": 1000
        },
        {
          "rotulo": "Kit ampliado ou edição",
          "modalidade": "edicao",
          "referencia": null
        }
      ]
    },
    {
      "cod": "A01",
      "categoria": "lg",
      "nome": "Kit de segurança e prevenção",
      "descricao": "Reforçar condutas seguras.",
      "escopo": "Por tema: cartaz, card, TV e roteiro de DDS. Conteúdo técnico validado pela área responsável.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, por tema",
          "modalidade": "novo",
          "referencia": 1200
        }
      ]
    },
    {
      "cod": "A02",
      "categoria": "lg",
      "nome": "Campanha para motoristas e operação",
      "descricao": "Reconhecimento, cuidados e rotinas em canais acessíveis.",
      "escopo": "Conceito, 4 cards e 1 motion até 30 s.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 1800
        }
      ]
    },
    {
      "cod": "A03",
      "categoria": "lg",
      "nome": "Manual de integração",
      "descricao": "Cultura, contatos, condutas e orientações de entrada.",
      "escopo": "PDF de até 12 páginas, com texto-base aprovado.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, até 12 páginas",
          "modalidade": "novo",
          "referencia": 1200
        }
      ]
    },
    {
      "cod": "A04",
      "categoria": "lg",
      "nome": "Manual de integração – atualização",
      "descricao": "Informações de ingresso atualizadas.",
      "escopo": "Até 4 páginas alteradas em arquivo existente.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Edição, até 4 páginas",
          "modalidade": "edicao",
          "referencia": 400
        }
      ]
    },
    {
      "cod": "A05",
      "categoria": "lg",
      "nome": "Kit de mudança de processo",
      "descricao": "O que mudou, quando e como executar.",
      "escopo": "Comunicado, infográfico simples e 5 slides.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 1000
        }
      ]
    },
    {
      "cod": "A06",
      "categoria": "lg",
      "nome": "Kit de recrutamento",
      "descricao": "Vaga, requisitos e proposta de trabalho com clareza.",
      "escopo": "3 peças estáticas para 1 vaga.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, 1 vaga",
          "modalidade": "novo",
          "referencia": 600
        }
      ]
    },
    {
      "cod": "A07",
      "categoria": "lg",
      "nome": "Sustentabilidade e responsabilidade social",
      "descricao": "Ações reais e indicadores fornecidos pela empresa.",
      "escopo": "Carrossel de 5 telas e PDF de 2 páginas.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 800
        }
      ]
    },
    {
      "cod": "A08",
      "categoria": "lg",
      "nome": "Tutorial de rastreamento",
      "descricao": "Uso dos canais existentes e menos dúvidas recorrentes.",
      "escopo": "Vídeo explicativo de 31 a 60 s, sem desenvolvimento de sistema.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 1400
        }
      ]
    },
    {
      "cod": "A09",
      "categoria": "lg",
      "nome": "Estudo de caso logístico",
      "descricao": "Capacidade demonstrada por resultados autorizados.",
      "escopo": "Texto até 800 palavras, PDF de 4 páginas e 1 entrevista remota.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 1200
        }
      ]
    },
    {
      "cod": "A10",
      "categoria": "lg",
      "nome": "Ficha comercial de serviço",
      "descricao": "Diferenciais, aplicações e condições operacionais.",
      "escopo": "PDF de 2 páginas para 1 serviço.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, 1 serviço",
          "modalidade": "novo",
          "referencia": 400
        }
      ]
    },
    {
      "cod": "A11",
      "categoria": "lg",
      "nome": "Landing page comercial",
      "descricao": "Concentrar oferta e captar contatos.",
      "escopo": "1 página responsiva, até 6 seções. Domínio, hospedagem e CRM excluídos.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 1800
        }
      ]
    },
    {
      "cod": "A12",
      "categoria": "lg",
      "nome": "Landing page – atualização",
      "descricao": "Atualizar conteúdo e oferta.",
      "escopo": "Até 2 seções de página existente.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Edição, até 2 seções",
          "modalidade": "edicao",
          "referencia": 400
        }
      ]
    },
    {
      "cod": "A13",
      "categoria": "lg",
      "nome": "E-mail – implementação e disparo",
      "descricao": "Distribuir conteúdo à base aprovada.",
      "escopo": "1 campanha, montagem e 1 disparo em plataforma existente.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, 1 campanha",
          "modalidade": "novo",
          "referencia": 700
        }
      ]
    },
    {
      "cod": "A14",
      "categoria": "lg",
      "nome": "Kit de comunicação para filiais",
      "descricao": "Padronizar a marca e agilizar comunicação local.",
      "escopo": "Matriz com 6 modelos editáveis.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo, 6 modelos",
          "modalidade": "novo",
          "referencia": 1200
        }
      ]
    },
    {
      "cod": "A15",
      "categoria": "lg",
      "nome": "Kit para filiais – localização",
      "descricao": "Endereço, contatos e informações da unidade.",
      "escopo": "Adaptação dos 6 modelos para 1 filial.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Edição, 1 filial",
          "modalidade": "edicao",
          "referencia": 300
        }
      ]
    },
    {
      "cod": "A16",
      "categoria": "lg",
      "nome": "Cobertura editorial remota de evento",
      "descricao": "Aproveitar o evento em conteúdo.",
      "escopo": "5 publicações e 1 vídeo até 30 s, com material fornecido.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Novo",
          "modalidade": "novo",
          "referencia": 1000
        }
      ]
    },
    {
      "cod": "A17",
      "categoria": "lg",
      "nome": "Tratamento de fotografias fornecidas",
      "descricao": "Melhorar acabamento de imagens.",
      "escopo": "Lote de 10 imagens: cor, luz e enquadramento.",
      "opcao": null,
      "video": false,
      "variantes": [
        {
          "rotulo": "Edição, lote de 10",
          "modalidade": "edicao",
          "referencia": 300
        }
      ]
    }
  ]
};
