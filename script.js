/**
 * FERDZ DIGITAL BANK PRO - FIREBASE V10 (MODULAR)
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    doc, 
    setDoc, 
    updateDoc, 
    collection, 
    query, 
    where, 
    getDocs, 
    onSnapshot, 
    runTransaction, 
    serverTimestamp, 
    increment, 
    arrayUnion 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Konfigirasyon Firebase ou an
const firebaseConfig = {
    apiKey: "AIzaSyBl37OlL6YZyJabdsCeArsq0gpgoVwtzvc",
    authDomain: "banque-e9319.firebaseapp.com",
    databaseURL: "https://banque-e9319-default-rtdb.firebaseio.com",
    projectId: "banque-e9319",
    storageBucket: "banque-e9319.firebasestorage.app",
    messagingSenderId: "632429158438",
    appId: "1:632429158438:web:aa802acb607b8dde1486e7"
};

// Inisyalize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

class FerdzBankFirebaseEngine {
    constructor() {
        this.currentUserData = null;
        this.bindEvents();
        this.listenAuthState();
    }

    bindEvents() {
        document.getElementById('btn-toggle-auth').addEventListener('click', () => this.toggleAuthMode());
        document.getElementById('btn-auth-submit').addEventListener('click', () => this.handleAuth());
        document.getElementById('btn-logout').addEventListener('click', () => this.logout());
        
        document.getElementById('btn-confirm-deposit').addEventListener('click', () => this.executeDeposit());
        document.getElementById('btn-confirm-withdraw').addEventListener('click', () => this.executeWithdraw());
        document.getElementById('btn-confirm-transfer').addEventListener('click', () => this.executeTransfer());
    }

    listenAuthState() {
        onAuthStateChanged(auth, (user) => {
            const authScreen = document.getElementById('auth-screen');
            const dashScreen = document.getElementById('dashboard-screen');

            if (user) {
                // Real-time listener sou dokiman itilizatè a
                onSnapshot(doc(db, "users", user.uid), (documentSnapshot) => {
                    if (documentSnapshot.exists()) {
                        this.currentUserData = { uid: user.uid, ...documentSnapshot.data() };
                        authScreen.classList.add('hidden-screen');
                        dashScreen.classList.remove('hidden-screen');
                        this.renderDashboard();
                    }
                });
            } else {
                this.currentUserData = null;
                dashScreen.classList.add('hidden-screen');
                authScreen.classList.remove('hidden-screen');
            }
        });
    }

    toggleAuthMode() {
        const signupFields = document.getElementById('signup-fields');
        const pinField = document.getElementById('pin-field');
        const submitBtn = document.getElementById('btn-auth-submit');
        const toggleText = document.getElementById('toggle-text');
        const toggleBtn = document.getElementById('btn-toggle-auth');

        const isSignup = signupFields.classList.contains('hidden');

        if (isSignup) {
            signupFields.classList.remove('hidden');
            pinField.classList.remove('hidden');
            submitBtn.innerText = "Créer mon Compte";
            toggleText.innerText = "Vous avez déjà un compte ?";
            toggleBtn.innerText = "Se connecter";
        } else {
            signupFields.classList.add('hidden');
            pinField.classList.add('hidden');
            submitBtn.innerText = "Se Connecter";
            toggleText.innerText = "Vous n'avez pas encore de compte ?";
            toggleBtn.innerText = "Créer un compte";
        }
    }

    async handleAuth() {
        const email = document.getElementById('auth-email').value.trim().toLowerCase();
        const password = document.getElementById('auth-password').value.trim();
        const fullname = document.getElementById('auth-fullname').value.trim();
        const pin = document.getElementById('auth-pin').value.trim();
        const isSignup = !document.getElementById('signup-fields').classList.contains('hidden');

        if (!email || !password) {
            this.showToast("Veuillez remplir tous les champs obligatoires.", "danger");
            return;
        }

        try {
            if (isSignup) {
                if (!fullname || pin.length !== 4) {
                    this.showToast("Le nom complet et un PIN à 4 chiffres sont requis.", "danger");
                    return;
                }

                // Kreye kont lan
                const userCredential = await createUserWithEmailAndPassword(auth, email, password);
                const user = userCredential.user;
                const accNumber = "FDZ-" + Math.floor(1000 + Math.random() * 9000) + "-" + Math.floor(1000 + Math.random() * 9000);

                // Enregistre pwofil nan Firestore
                await setDoc(doc(db, "users", user.uid), {
                    fullname: fullname,
                    email: email,
                    pin: pin,
                    accountNumber: accNumber,
                    balance: 0,
                    income: 0,
                    expense: 0,
                    transactions: [],
                    createdAt: serverTimestamp()
                });

                this.showToast("Compte créé avec succès !", "success");
            } else {
                // Konektyon
                await signInWithEmailAndPassword(auth, email, password);
                this.showToast("Connexion réussie !", "success");
            }
        } catch (error) {
            let msg = "Erreur d'authentification.";
            if(error.code === 'auth/email-already-in-use') msg = "Cet email est déjà utilisé.";
            if(error.code === 'auth/invalid-credential') msg = "Email ou mot de passe incorrect.";
            if(error.code === 'auth/weak-password') msg = "Le mot de passe doit contenir au moins 6 caractères.";
            this.showToast(msg, "danger");
        }
    }

    logout() {
        signOut(auth).then(() => {
            this.showToast("Déconnexion effectuée.", "info");
        });
    }

    renderDashboard() {
        const user = this.currentUserData;
        if (!user) return;

        document.getElementById('user-display-name').innerText = user.fullname;
        document.getElementById('card-holder-name').innerText = user.fullname.toUpperCase();
        document.getElementById('user-account-number').innerText = user.accountNumber;
        document.getElementById('user-avatar').innerText = user.fullname.charAt(0).toUpperCase();

        document.getElementById('balance-display').innerText = this.formatCurrency(user.balance || 0);
        document.getElementById('stat-income').innerText = "+" + this.formatCurrency(user.income || 0);
        document.getElementById('stat-expense').innerText = "-" + this.formatCurrency(user.expense || 0);

        const historyContainer = document.getElementById('transaction-history');
        const txList = user.transactions || [];
        document.getElementById('tx-count').innerText = txList.length;
        historyContainer.innerHTML = "";

        if (txList.length === 0) {
            historyContainer.innerHTML = `<div style="text-align:center; padding:20px; color:#64748b; font-size:0.85rem;">Aucune opération récente</div>`;
            return;
        }

        // Afiche tranzaksyon ki pi resan yo an premye (reverse)
        [...txList].reverse().forEach(tx => {
            const isPositive = tx.amount > 0;
            const item = document.createElement('div');
            item.className = 'tx-item';
            item.innerHTML = `
                <div class="tx-info">
                    <h4>${tx.title}</h4>
                    <p>${tx.date}</p>
                </div>
                <span class="tx-amount ${isPositive ? 'text-success' : 'text-danger'}">
                    ${isPositive ? '+' : ''}${this.formatCurrency(tx.amount)}
                </span>
            `;
            historyContainer.appendChild(item);
        });
    }

    async executeDeposit() {
        const amount = parseFloat(document.getElementById('deposit-amount').value);
        if (!amount || amount <= 0) {
            this.showToast("Saisissez un montant valide.", "danger");
            return;
        }

        const userRef = doc(db, "users", this.currentUserData.uid);
        const dateStr = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

        try {
            await updateDoc(userRef, {
                balance: increment(amount),
                income: increment(amount),
                transactions: arrayUnion({
                    title: "Dépôt sur compte",
                    amount: amount,
                    date: dateStr
                })
            });

            window.closeModal('deposit-modal');
            document.getElementById('deposit-amount').value = "";
            this.showToast("Dépôt réussi !", "success");
        } catch (error) {
            this.showToast("Erreur lors du dépôt.", "danger");
        }
    }

    async executeWithdraw() {
        const amount = parseFloat(document.getElementById('withdraw-amount').value);
        if (!amount || amount <= 0) {
            this.showToast("Saisissez un montant valide.", "danger");
            return;
        }

        if (this.currentUserData.balance < amount) {
            this.showToast("Solde insuffisant.", "danger");
            return;
        }

        const userRef = doc(db, "users", this.currentUserData.uid);
        const dateStr = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

        try {
            await updateDoc(userRef, {
                balance: increment(-amount),
                expense: increment(amount),
                transactions: arrayUnion({
                    title: "Retrait d'argent",
                    amount: -amount,
                    date: dateStr
                })
            });

            window.closeModal('withdraw-modal');
            document.getElementById('withdraw-amount').value = "";
            this.showToast("Retrait effectué !", "success");
        } catch (error) {
            this.showToast("Erreur lors du retrait.", "danger");
        }
    }

    async executeTransfer() {
        const recipientEmail = document.getElementById('transfer-recipient').value.trim().toLowerCase();
        const amount = parseFloat(document.getElementById('transfer-amount').value);
        const pin = document.getElementById('transfer-pin').value.trim();

        if (!recipientEmail || !amount || amount <= 0) {
            this.showToast("Veuillez vérifier les champs.", "danger");
            return;
        }

        if (pin !== this.currentUserData.pin) {
            this.showToast("Code PIN incorrect !", "danger");
            return;
        }

        if (recipientEmail === this.currentUserData.email) {
            this.showToast("Virement vers soi-même impossible.", "danger");
            return;
        }

        if (this.currentUserData.balance < amount) {
            this.showToast("Solde insuffisant.", "danger");
            return;
        }

        try {
            // Rechèche Destinataire
            const usersRef = collection(db, "users");
            const q = query(usersRef, where("email", "==", recipientEmail));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                this.showToast("Destinataire introuvable.", "danger");
                return;
            }

            const recipientDoc = querySnapshot.docs[0];
            const recipientRef = doc(db, "users", recipientDoc.id);
            const recipientData = recipientDoc.data();
            const senderRef = doc(db, "users", this.currentUserData.uid);
            
            const dateStr = new Date().toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });

            // Firestore Atomic Transaction pou Sekirite
            await runTransaction(db, async (transaction) => {
                transaction.update(senderRef, {
                    balance: increment(-amount),
                    expense: increment(amount),
                    transactions: arrayUnion({
                        title: `Virement envoyé à ${recipientData.fullname}`,
                        amount: -amount,
                        date: dateStr
                    })
                });

                transaction.update(recipientRef, {
                    balance: increment(amount),
                    income: increment(amount),
                    transactions: arrayUnion({
                        title: `Virement reçu de ${this.currentUserData.fullname}`,
                        amount: amount,
                        date: dateStr
                    })
                });
            });

            window.closeModal('transfer-modal');
            document.getElementById('transfer-recipient').value = "";
            document.getElementById('transfer-amount').value = "";
            document.getElementById('transfer-pin').value = "";

            this.showToast("Virement exécuté instantanément !", "success");
        } catch (error) {
            this.showToast("Erreur virement : " + error.message, "danger");
        }
    }

    formatCurrency(val) {
        return val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " HTG";
    }

    showToast(msg, type = "info") {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 3500);
    }
}

// Ekspoze fonksyon yo nan window pou HTML la ka wè yo (akoz type="module")
window.openModal = function(id) { document.getElementById(id).classList.add('active'); };
window.closeModal = function(id) { document.getElementById(id).classList.remove('active'); };

// Demare aplikasyon an
const appEngine = new FerdzBankFirebaseEngine();
