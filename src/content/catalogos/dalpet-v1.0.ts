/* Catálogo da DalPet (prospect em teste de 48 h): mesmos serviços e valores de referência do molde (B&M Log v1.0).
   Desconto 0: o pacote e os valores só são propostos depois das 48 h (decisão de 29/10/2026). O Bônus 15% da DalPet é campo
   próprio do cliente (passo 5), separado do desconto de catálogo. Nada é herdado da B&M Log. */
import type { Catalogo } from "@/lib/tipos";
import { catalogoBmlogV1 } from "./bmlog-v1.0";

export const catalogoDalpetV1: Catalogo = { ...catalogoBmlogV1, clienteId: "dalpet", desconto: 0 };
