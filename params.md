# 📦 Système de Gestion de Stock PPN

## 🎯 Objectif
Mettre en place un système intelligent capable de :
- Gérer différents types d’unités (bidon, sac, carton, paquet…)
- Convertir automatiquement en unité de base
- Calculer le stock réel

---

## 🧠 Principe Général

Chaque produit doit avoir :
- Une **unité de base**
- Des **unités secondaires avec conversion**

---

## 📊 Produits et Unités

| Produit | Unité de base |
|--------|--------------|
| Huile | litre |
| Sucre | kg |
| Riz | kg |
| Farine | kg |
| Sachet | pièce |

---

## 🔁 Table de Conversion

| Produit | Unité | Équivalence |
|--------|------|------------|
| Huile | 1 bidon | 20 litres |
| Sucre | 1 sac | 50 kg |
| Riz | 1 sac | 50 kg |
| Farine | 1 sac | 50 kg |
| Carton | 1 carton | 1500 paquets |
| Paquet | 1 paquet | X pièces |

⚠️ **Important :**
- Définir : `1 paquet = combien de pièces`

---

## ⚙️ Exemple de Calcul

### 🛢️ Huile
Entrée :