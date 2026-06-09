import { useState } from 'react';

export default function CalculatorKeypad({ activeItem, onResult, onOpenDiscount, onClose }) {
  const [display, setDisplay] = useState('0');

  const handlePress = (value) => {
    setDisplay(prev => (prev === '0' && value !== '.' ? value : prev + value));
  };

  const calculateTotal = (qty, type) => {
    const factor = activeItem?.facteur || 1;
    // Utiliser price_superior si type='superior', sinon utiliser price_unit ou price (prix par défaut)
    const price = type === 'superior' 
        ? (activeItem?.price_superior || activeItem?.price || 0) 
        : (activeItem?.price_unit || activeItem?.price || 0);
    
    // Formule: total = (qté * (facteur/facteur)) * price_final
    const total = (qty * (factor / factor)) * price;
    
    return total;
  };

  const addQuantityByUnit = (type) => {
    const val = parseFloat(display) > 0 ? parseFloat(display) : 0; 
    const unitQty = type === 'superior' ? (activeItem?.quantite_par_unite || 1) : 1;
    const increment = (val === 0 ? 1 : val) * unitQty;
    
    // Calcul de la nouvelle quantité et du nouveau montant ajouté
    const newQty = (activeItem?.quantity || 0) + increment;
    const addedTotal = calculateTotal(val === 0 ? 1 : val, type);
    
    console.log("Calculator - addQuantityByUnit:", { val, unitQty, increment, newQty, addedTotal });
    
    // On transmet la nouvelle quantité totale et le montant à ajouter
    onResult(newQty, addedTotal);
    setDisplay('0');
  };

  return (
    <div className="bg-white border border-slate-100 rounded-2xl p-2.5 flex flex-col gap-2 shadow-xl">
        <div className="flex items-center justify-between gap-2">
            <h3 className="text-[15px] font-black text-slate-800 uppercase truncate px-1 flex-1">
                {activeItem ? activeItem.name : "Sélectionner un produit"}
            </h3>
            <button onClick={onClose} className="text-red-500 hover:text-red-700 font-black text-lg p-1">X</button>
        </div>
        
        {/* DISPLAY */}
        <div className="bg-slate-900 rounded-lg p-2 text-right text-2xl font-black text-red-400 h-9 flex items-center justify-end overflow-hidden shadow-inner">
            {display}
        </div>


        {/* NUMERIC PAD */}
        <div className="grid grid-cols-3 gap-1.5">
          {['7', '8', '9', '4', '5', '6', '1', '2', '3', '0', '.', 'C'].map((btn) => (
            <button 
              key={btn}
              onClick={() => btn === 'C' ? setDisplay('0') : handlePress(btn)}
              className="bg-slate-100 hover:bg-slate-200 p-2 rounded-lg font-bold text-slate-800 text-base transition-all"
            >
              {btn}
            </button>
          ))}
        </div>
          
        {/* DYNAMIC ACTIONS */}
        <div className="grid grid-cols-2 gap-1.5 mt-0.5">
            <button 
                onClick={() => activeItem && addQuantityByUnit('base')} 
                disabled={!activeItem}
                className={`${activeItem ? 'bg-red-600 hover:bg-red-700' : 'bg-slate-200'} text-white p-2 rounded-lg font-black text-[15px] uppercase shadow-md transition-all`}
            >
                + {activeItem?.unite_base || 'PCE'}
            </button>
            
            {activeItem && activeItem.quantite_par_unite > 1 && (
                <button 
                    onClick={() => addQuantityByUnit('superior')} 
                    className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-lg font-black text-[15px] uppercase shadow-md transition-all"
                >
                    + {activeItem.unite_superieure || 'CTN'}
                </button>
            )}
        </div>

        {/* PRICES INFO */}
        {activeItem && (
            <div className="mt-1 p-2 bg-slate-50 rounded-xl border border-slate-100 flex flex-col gap-0.5">
                <div className="flex justify-between items-center text-[13px]">
                    <span className="font-bold text-slate-500 uppercase">Prix {activeItem.unite_base || 'Unité'} :</span>
                    <span className="font-black text-red-600">{(activeItem.price || 0).toLocaleString()} Ar</span>
                </div>
                {activeItem.quantite_par_unite > 1 && activeItem.price_superior && (
                    <div className="flex justify-between items-center text-[13px]">
                        <span className="font-bold text-slate-500 uppercase">Prix {activeItem.unite_superieure || 'Unité'} :</span>
                        <span className="font-black text-red-600">{(activeItem.price_superior || 0).toLocaleString()} Ar</span>
                    </div>
                )}
            </div>
        )}
    </div>
  );
}

