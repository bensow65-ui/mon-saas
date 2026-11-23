"use client";

import { useState, useEffect } from "react";
import { checkUserAccess } from "@/lib/subscription";

interface Item {
  description: string;
  quantity: number;
  price: number;
}

interface SavedInvoice {
  id: string;
  date: string;
  dueDate: string;
  status: string;
  myCompany: string;
  clientName: string;
  clientPhone: string;
  items: Item[];
  discount: number;
  tax: number;
  total: number;
  logo: string | null;
}

export default function Page() {
  const [formData, setFormData] = useState({
    myCompany: "",
    clientName: "",
    clientPhone: "",
    dueDate: "",
    status: "En attente",
    discount: 0,
    tax: 0,
  });

  const [logo, setLogo] = useState<string | null>(null);

  const [items, setItems] = useState<Item[]>([
    { description: "", quantity: 1, price: 0 },
  ]);

  const [history, setHistory] = useState<SavedInvoice[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("Tous");
const [trialEndsAt, setTrialEndsAt] = useState<Date | null>(null);
  const [nowDate, setNowDate] = useState<Date | null>(null);

  useEffect(() => {
    const current = new Date();
    setNowDate(current);
    setTrialEndsAt(new Date(current.getTime() + 5 * 24 * 60 * 60 * 1000));
  }, []);

  const userSubscription = {
    trialEndsAt: trialEndsAt ?? new Date(2099, 0, 1),
    subscriptionStatus: "trial" as const,
  };

  const { canAccess, isTrial, daysLeft } = checkUserAccess(
    userSubscription,
    nowDate ?? undefined
  );

  useEffect(() => {
    const saved = localStorage.getItem("factures_express_history");
    if (saved) {
      try {
        setHistory(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  const handleFormChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { id, value } = e.target;
    setFormData({
      ...formData,
      [id]: id === "discount" || id === "tax" ? Number(value) : value,
    });
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setLogo(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleItemChange = (
    index: number,
    field: keyof Item,
    value: string | number
  ) => {
    const newItems = [...items];
    newItems[index] = {
      ...newItems[index],
      [field]: field === "description" ? value : Number(value),
    };
    setItems(newItems);
  };

  const addItem = () => {
    setItems([...items, { description: "", quantity: 1, price: 0 }]);
  };

  const removeItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const calculateSubtotal = () => {
    return items.reduce(
      (total, item) => total + Number(item.quantity || 0) * Number(item.price || 0),
      0
    );
  };

  const calculateFinalTotal = () => {
    const sub = calculateSubtotal();
    const discountAmount = (sub * Number(formData.discount || 0)) / 100;
    const afterDiscount = sub - discountAmount;
    const taxAmount = (afterDiscount * Number(formData.tax || 0)) / 100;
    return Math.round(afterDiscount + taxAmount);
  };

  const formatAmount = (num: number) => {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  };

  const saveToHistory = () => {
    const total = calculateFinalTotal();
    const newInvoice: SavedInvoice = {
      id: `FACT-${Math.floor(1000 + Math.random() * 9000)}`,
      date: new Date().toLocaleDateString("fr-FR"),
      dueDate: formData.dueDate,
      status: formData.status,
      myCompany: formData.myCompany,
      clientName: formData.clientName,
      clientPhone: formData.clientPhone,
      items: [...items],
      discount: formData.discount,
      tax: formData.tax,
      total,
      logo,
    };

    const updatedHistory = [newInvoice, ...history];
    setHistory(updatedHistory);
    localStorage.setItem(
      "factures_express_history",
      JSON.stringify(updatedHistory)
    );
  };

  const loadInvoice = (inv: SavedInvoice) => {
    setFormData({
      myCompany: inv.myCompany,
      clientName: inv.clientName,
      clientPhone: inv.clientPhone,
      dueDate: inv.dueDate || "",
      status: inv.status || "En attente",
      discount: inv.discount || 0,
      tax: inv.tax || 0,
    });
    setItems(inv.items);
    setLogo(inv.logo || null);
  };

  const toggleInvoiceStatus = (targetId: string) => {
    const updatedHistory = history.map((inv) => {
      if (inv.id === targetId) {
        const newStatus = inv.status === "Payée" ? "En attente" : "Payée";
        return { ...inv, status: newStatus };
      }
      return inv;
    });
    setHistory(updatedHistory);
    localStorage.setItem(
      "factures_express_history",
      JSON.stringify(updatedHistory)
    );
  };

  const clearHistory = () => {
    setHistory([]);
    localStorage.removeItem("factures_express_history");
  };

  const exportToCSV = () => {
    if (history.length === 0) return;

    let csvContent = "data:text/csv;charset=utf-8,ID;Date;Client;Statut;Total (FCFA)\n";
    history.forEach((inv) => {
      csvContent += `${inv.id};${inv.date};${inv.clientName};${inv.status};${inv.total}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "historique_factures.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const generatePDF = async () => {
    saveToHistory();
    const { jsPDF } = await import("jspdf");
    const doc = new jsPDF();

    let startY = 25;

    if (logo) {
      try {
        doc.addImage(logo, "PNG", 20, 15, 25, 25);
        startY = 45;
      } catch (err) {
        console.error("Erreur logo", err);
      }
    }

    doc.setFontSize(18);
    doc.text(formData.myCompany || "Mon Entreprise", logo ? 50 : 20, 25);

    doc.setFontSize(10);
    doc.setTextColor(100);
    const invoiceNum = `FACT-${Math.floor(1000 + Math.random() * 9000)}`;
    doc.text(`N° de Facture : ${invoiceNum}`, 135, 20);
    doc.text(`Date : ${new Date().toLocaleDateString("fr-FR")}`, 135, 26);
    if (formData.dueDate) {
      doc.text(`Échéance : ${formData.dueDate}`, 135, 32);
    }
    doc.text(`Statut : ${formData.status.toUpperCase()}`, 135, 38);

    doc.setTextColor(0);
    doc.setFontSize(11);
    doc.text(`Facturé à : ${formData.clientName || "Client"}`, 20, startY);
    doc.text(`Téléphone : ${formData.clientPhone || "-"}`, 20, startY + 6);

    let y = startY + 20;
    doc.setFontSize(10);
    doc.text("Description", 20, y);
    doc.text("Qté", 95, y);
    doc.text("Prix unitaire", 120, y);
    doc.text("Total", 160, y);

    doc.line(20, y + 2, 190, y + 2);

    y += 8;
    items.forEach((item) => {
      const qte = Number(item.quantity || 0);
      const px = Number(item.price || 0);
      const lineTotal = qte * px;

      doc.text(item.description || "-", 20, y);
      doc.text(qte.toString(), 95, y);
      doc.text(`${formatAmount(px)} FCFA`, 120, y);
      doc.text(`${formatAmount(lineTotal)} FCFA`, 160, y);
      y += 8;
    });

    doc.line(20, y + 2, 190, y + 2);

    y += 10;
    const sub = calculateSubtotal();
    doc.setFontSize(11);
    doc.text(`Sous-total : ${formatAmount(sub)} FCFA`, 130, y);

    if (formData.discount > 0) {
      y += 6;
      doc.text(`Remise (${formData.discount}%) : -${formatAmount((sub * formData.discount) / 100)} FCFA`, 130, y);
    }

    if (formData.tax > 0) {
      y += 6;
      const afterDisc = sub - (sub * formData.discount) / 100;
      doc.text(`TVA / Taxe (${formData.tax}%) : +${formatAmount((afterDisc * formData.tax) / 100)} FCFA`, 130, y);
    }

    y += 10;
    doc.setFontSize(13);
    doc.text(`TOTAL : ${formatAmount(calculateFinalTotal())} FCFA`, 120, y);

    doc.save(`Facture_${formData.clientName || "Client"}.pdf`);
  };

  const sendWhatsApp = () => {
    saveToHistory();
    const total = calculateFinalTotal();
    const message = `Bonjour ${formData.clientName}, voici le récapitulatif de votre facture (${formData.status}) d'un montant total de ${formatAmount(total)} FCFA. Merci !`;
    const encodedMessage = encodeURIComponent(message);
    const phoneNumber = formData.clientPhone.replace(/[^0-9]/g, "");
    window.open(`https://wa.me/${phoneNumber}?text=${encodedMessage}`, "_blank");
  };

  const filteredHistory = history.filter((inv) => {
    const matchesSearch =
      inv.clientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      inv.id.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesStatus =
      statusFilter === "Tous" || inv.status === statusFilter;

    return matchesSearch && matchesStatus;
  });

  const totalPaid = history
    .filter((inv) => inv.status === "Payée")
    .reduce((acc, inv) => acc + inv.total, 0);

  const totalPending = history
    .filter((inv) => inv.status === "En attente")
    .reduce((acc, inv) => acc + inv.total, 0);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="max-w-3xl mx-auto space-y-6">

        {/* BANNIÈRE D'ESSAI GRATUIT */}
        {isTrial && (
          <div className="bg-amber-100 border-l-4 border-amber-500 text-amber-700 p-4 rounded shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <p className="text-sm">
              ⚠️ Période d&apos;essai gratuit en cours : Il vous reste <strong>{daysLeft} jours</strong> pour tester Facture Express.
            </p>
            <button
              onClick={() => alert("Redirection vers la page de mise à niveau Pro...")}
              className="bg-amber-600 text-white px-4 py-2 rounded text-sm font-semibold hover:bg-amber-700 transition"
            >
              Passer à la version Pro
            </button>
          </div>
        )}

        {/* Tableau de bord financier */}
        {history.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              onClick={() => setStatusFilter("Tous")}
              className={`bg-white p-4 rounded-md shadow-sm border-l-4 border-blue-500 cursor-pointer hover:bg-blue-50 transition ${statusFilter === "Tous" ? "ring-2 ring-blue-400" : ""}`}
            >
              <p className="text-xs text-gray-500 font-medium">Chiffre d&apos;affaires (Payé)</p>
              <p className="text-lg font-bold text-gray-800">{formatAmount(totalPaid)} FCFA</p>
            </div>

            <div
              onClick={() => setStatusFilter("Payée")}
              className={`bg-white p-4 rounded-md shadow-sm border-l-4 border-green-500 cursor-pointer hover:bg-green-50 transition ${statusFilter === "Payée" ? "ring-2 ring-green-400" : ""}`}
            >
              <p className="text-xs text-gray-500 font-medium">Total Encaissé (Payé)</p>
              <p className="text-lg font-bold text-green-600">{formatAmount(totalPaid)} FCFA</p>
            </div>

            <div
              onClick={() => setStatusFilter("En attente")}
              className={`bg-white p-4 rounded-md shadow-sm border-l-4 border-yellow-500 cursor-pointer hover:bg-yellow-50 transition ${statusFilter === "En attente" ? "ring-2 ring-yellow-400" : ""}`}
            >
              <p className="text-xs text-gray-500 font-medium">En Attente de paiement</p>
              <p className="text-lg font-bold text-yellow-600">{formatAmount(totalPending)} FCFA</p>
            </div>
          </div>
        )}

        <div className="bg-white p-8 rounded-md shadow-md">
          <h1 className="text-2xl font-bold mb-6 text-gray-900">
            Créer une Facture Express
          </h1>

          <form onSubmit={(e) => e.preventDefault()} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Logo de l&apos;entreprise
              </label>
              <div className="flex items-center gap-4">
                {logo && (
                  <img
                    src={logo}
                    alt="Logo"
                    className="h-16 w-16 object-contain border rounded-md p-1"
                  />
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nom de votre entreprise
                </label>
                <input
                  type="text"
                  id="myCompany"
                  value={formData.myCompany}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nom du client
                </label>
                <input
                  type="text"
                  id="clientName"
                  value={formData.clientName}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md text-gray-900"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Téléphone du client
                </label>
                <input
                  type="tel"
                  id="clientPhone"
                  placeholder="+221770000000"
                  value={formData.clientPhone}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md text-gray-900"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date d&apos;échéance
                </label>
                <input
                  type="date"
                  id="dueDate"
                  value={formData.dueDate}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Statut du paiement
                </label>
                <select
                  id="status"
                  value={formData.status}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md text-gray-900 bg-white"
                >
                  <option value="En attente">En attente</option>
                  <option value="Payée">Payée</option>
                  <option value="Annulée">Annulée</option>
                </select>
              </div>
            </div>

            <div>
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                Articles / Prestations
              </h2>

              {items.map((item, index) => (
                <div key={index} className="flex gap-2 items-center mb-3">
                  <input
                    type="text"
                    placeholder="Description"
                    value={item.description}
                    onChange={(e) =>
                      handleItemChange(index, "description", e.target.value)
                    }
                    className="flex-1 p-2 border rounded-md text-gray-900"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Qté"
                    value={item.quantity}
                    min="1"
                    onChange={(e) =>
                      handleItemChange(index, "quantity", e.target.value)
                    }
                    className="w-20 p-2 border rounded-md text-gray-900"
                    required
                  />
                  <input
                    type="number"
                    placeholder="Prix unitaire"
                    value={item.price}
                    onChange={(e) =>
                      handleItemChange(index, "price", e.target.value)
                    }
                    className="w-36 p-2 border rounded-md text-gray-900"
                    required
                  />
                  {items.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="bg-red-500 text-white px-3 py-2 rounded-md hover:bg-red-600"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={addItem}
                className="mt-2 text-sm font-medium text-blue-600 hover:text-blue-800"
              >
                + Ajouter une ligne
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Remise globale (%)
                </label>
                <input
                  type="number"
                  id="discount"
                  min="0"
                  max="100"
                  value={formData.discount}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md text-gray-900"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">
                  TVA / Taxe (%)
                </label>
                <input
                  type="number"
                  id="tax"
                  min="0"
                  max="100"
                  value={formData.tax}
                  onChange={handleFormChange}
                  className="mt-1 w-full p-2 border rounded-md text-gray-900"
                />
              </div>
            </div>

            <div className="text-right text-xl font-bold text-gray-900 pt-4 border-t">
              Total : {formatAmount(calculateFinalTotal())} FCFA
            </div>

            <div className="flex space-x-4 pt-4">
              <button
                type="button"
                onClick={generatePDF}
                className="w-1/2 bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700 font-medium"
              >
                Télécharger PDF
              </button>
              <button
                type="button"
                onClick={sendWhatsApp}
                className="w-1/2 bg-green-600 text-white py-2 rounded-md hover:bg-green-700 font-medium"
              >
                Relancer via WhatsApp
              </button>
            </div>
          </form>
        </div>

        {history.length > 0 && (
          <div className="bg-white p-6 rounded-md shadow-md space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-bold text-gray-900">
                Historique des factures ({filteredHistory.length}/{history.length})
              </h2>
              <div className="flex gap-3">
                <button
                  onClick={exportToCSV}
                  className="text-xs bg-gray-200 text-gray-700 px-3 py-1 rounded-md hover:bg-gray-300 font-medium"
                >
                  📥 Exporter CSV / Excel
                </button>
                <button
                  onClick={clearHistory}
                  className="text-xs text-red-500 hover:underline"
                >
                  Effacer l&apos;historique
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input
                type="text"
                placeholder="🔍 Rechercher (client, n°)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="md:col-span-2 w-full p-2 border rounded-md text-gray-900 text-sm"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full p-2 border rounded-md text-gray-900 text-sm bg-white"
              >
                <option value="Tous">Tous les statuts</option>
                <option value="En attente">En attente</option>
                <option value="Payée">Payées</option>
                <option value="Annulée">Annulées</option>
              </select>
            </div>

            <div className="space-y-3 max-h-60 overflow-y-auto">
              {filteredHistory.length === 0 ? (
                <p className="text-sm text-gray-500 text-center py-4">
                  Aucune facture ne correspond à vos critères.
                </p>
              ) : (
                filteredHistory.map((inv, idx) => (
                  <div
                    key={idx}
                    className="flex justify-between items-center p-3 border rounded-md hover:bg-gray-50"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800">
                          {inv.clientName || "Client sans nom"} ({inv.id})
                        </p>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            inv.status === "Payée"
                              ? "bg-green-100 text-green-800"
                              : inv.status === "Annulée"
                              ? "bg-red-100 text-red-800"
                              : "bg-yellow-100 text-yellow-800"
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-500">
                        {inv.date} - {formatAmount(inv.total)} FCFA
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => toggleInvoiceStatus(inv.id)}
                        className={`text-xs px-3 py-1 rounded-md font-medium ${
                          inv.status === "Payée"
                            ? "bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                            : "bg-green-100 text-green-700 hover:bg-green-200"
                        }`}
                      >
                        {inv.status === "Payée" ? "Mettre en attente" : "Marquer comme Payée"}
                      </button>

                      <button
                        type="button"
                        onClick={() => loadInvoice(inv)}
                        className="text-sm text-blue-600 hover:underline font-medium"
                      >
                        Recharger
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* MODALE DE BLOCAGE SI EXPIRÉ */}
        {!canAccess && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50">
            <div className="bg-white p-8 rounded-2xl max-w-md w-full text-center shadow-2xl">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">Votre essai gratuit est terminé</h2>
              <p className="text-gray-600 mb-6 text-sm">
                Pour continuer à générer des factures et gérer votre activité sans aucune limite, activez votre abonnement mensuel dès maintenant.
              </p>

              <div className="bg-gray-50 border border-gray-100 p-4 rounded-xl mb-6">
                <span className="text-3xl font-extrabold text-blue-600">2 000 FCFA</span>
                <span className="text-gray-500 text-sm"> / mois</span>
              </div>

              <button
                onClick={() => alert("Redirection vers le paiement Wave / Orange Money...")}
                className="w-full bg-green-600 text-white py-3 rounded-xl font-bold hover:bg-green-700 transition shadow-md"
              >
                Payer via Wave / Orange Money
              </button>

              <p className="text-xs text-gray-400 mt-4">
                Activation automatique après validation du paiement.
              </p>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}