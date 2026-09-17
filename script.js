import { initializeApp } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, runTransaction } from "https://www.gstatic.com/firebasejs/10.4.0/firebase-firestore.js";

// Konfigirasyon pèsonèl Firebase ou an
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

// Enskripsyon Service Worker pou PWA
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(err => console.log("SW error:", err));
}

// Eleman UI yo
const authSection = document.getElementById('auth-section');
const dashSection = document.getElementById('dashboard-section');
const balanceDisplay = document.getElementById('balance-display');
const userEmailDisplay = document.getElementById('user-email-display');
const authError = document.getElementById('auth-error');
const transferMsg = document.getElementById('transfer-msg');

let currentUserDoc = null;

// Siveye si itilizatè a konekte oswa dekonekte
onAuthStateChanged(auth, async (user) => {
    if (user) {
        console.log("Utilisateur connecté :", user.email);
        authSection.classList.remove('active');
        dashSection.classList.add('active');
        userEmailDisplay.innerText = user.email;
        await loadOrCreateUserData(user);
    } else {
        console.log("Utilisateur déconnecté");
        dashSection.classList.remove('active');
        authSection.classList.add('active');
    }
});

// Chaje oswa kreye done itilizatè a
async function loadOrCreateUserData(user) {
    currentUserDoc = doc(db, 'users', user.uid);
    try {
        const docSnap = await getDoc(currentUserDoc);
        if (docSnap.exists()) {
            balanceDisplay.innerText = docSnap.data().balance.toFixed(2) + " HTG";
        } else {
            await setDoc(currentUserDoc, {
                email: user.email,
                balance: 0
            });
            balanceDisplay.innerText = "0.00 HTG";
        }
    } catch (error) {
        console.error("Erreur Firestore :", error);
        alert("Erreur lors du chargement des données. Vérifiez si vous avez bien créé et configuré Firestore Database dans la console.");
    }
}

// Kreye kont
document.getElementById('signup-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    authError.innerText = "";

    if (!email || !password) {
        authError.innerText = "Veuillez remplir tous les champs.";
        return;
    }

    try {
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await setDoc(doc(db, 'users', userCred.user.uid), {
            email: email,
            balance: 0
        });
    } catch (error) {
        authError.innerText = getErrorMessage(error.code);
    }
});

// Konekte
document.getElementById('login-btn').addEventListener('click', async () => {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value.trim();
    authError.innerText = "";

    if (!email || !password) {
        authError.innerText = "Veuillez remplir tous les champs.";
        return;
    }

    try {
        await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
        authError.innerText = getErrorMessage(error.code);
    }
});

// Dekonekte
document.getElementById('logout-btn').addEventListener('click', () => signOut(auth));

// Depo
document.getElementById('deposit-btn').addEventListener('click', async () => {
    const amountInput = document.getElementById('amount');
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) return;

    try {
        const docSnap = await getDoc(currentUserDoc);
        const newBalance = (docSnap.data().balance || 0) + amount;
        await updateDoc(currentUserDoc, { balance: newBalance });
        amountInput.value = "";
        loadOrCreateUserData(auth.currentUser);
    } catch (err) {
        alert("Erreur lors du dépôt : " + err.message);
    }
});

// Retrè
document.getElementById('withdraw-btn').addEventListener('click', async () => {
    const amountInput = document.getElementById('amount');
    const amount = parseFloat(amountInput.value);
    if (!amount || amount <= 0) return;

    try {
        const docSnap = await getDoc(currentUserDoc);
        const currentBalance = docSnap.data().balance || 0;
        if (currentBalance >= amount) {
            const newBalance = currentBalance - amount;
            await updateDoc(currentUserDoc, { balance: newBalance });
            amountInput.value = "";
            loadOrCreateUserData(auth.currentUser);
        } else {
            alert("Fonds insuffisants");
        }
    } catch (err) {
        alert("Erreur lors du retrait : " + err.message);
    }
});

// VIREMENT P2P (Envoyer de l'argent)
document.getElementById('transfer-btn').addEventListener('click', async () => {
    const receiverEmail = document.getElementById('transfer-email').value.trim();
    const amountInput = document.getElementById('transfer-amount');
    const amount = parseFloat(amountInput.value);
    transferMsg.style.color = "#ef4444";
    
    if (!amount || amount <= 0 || !receiverEmail) {
        transferMsg.innerText = "Informations invalides";
        return;
    }

    if (receiverEmail.toLowerCase() === auth.currentUser.email.toLowerCase()) {
        transferMsg.innerText = "Vous ne pouvez pas envoyer d'argent à vous-même";
        return;
    }

    try {
        const q = query(collection(db, "users"), where("email", "==", receiverEmail));
        const querySnapshot = await getDocs(q);
        
        if (querySnapshot.empty) {
            transferMsg.innerText = "Utilisateur introuvable";
            return;
        }

        const receiverDocRef = querySnapshot.docs[0].ref;

        await runTransaction(db, async (transaction) => {
            const senderDoc = await transaction.get(currentUserDoc);
            const receiverDoc = await transaction.get(receiverDocRef);

            const senderBalance = senderDoc.data().balance || 0;
            if (senderBalance < amount) {
                throw new Error("Fonds insuffisants pour ce virement");
            }

            transaction.update(currentUserDoc, { balance: senderBalance - amount });
            transaction.update(receiverDocRef, { balance: (receiverDoc.data().balance || 0) + amount });
        });

        transferMsg.style.color = "#22c55e";
        transferMsg.innerText = "Virement réussi !";
        amountInput.value = "";
        document.getElementById('transfer-email').value = "";
        loadOrCreateUserData(auth.currentUser);
        
    } catch (error) {
        transferMsg.innerText = error.message || error;
    }
});

// Tradiksyon mesaj erè
function getErrorMessage(code) {
    switch (code) {
        case 'auth/user-not-found': return 'Aucun utilisateur trouvé avec cet email.';
        case 'auth/wrong-password': return 'Mot de passe incorrect.';
        case 'auth/email-already-in-use': return 'Cet email est déjà utilisé.';
        case 'auth/weak-password': return 'Le mot de passe doit faire au moins 6 caractères.';
        case 'auth/invalid-email': return 'Adresse email invalide.';
        default: return 'Une erreur est survenue : ' + code;
    }
}
