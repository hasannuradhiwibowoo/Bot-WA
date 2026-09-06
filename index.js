const {
    default: makeWASocket,
    useMultiFileAuthState,
    DisconnectReason,
    downloadMediaMessage,
} = require("@whiskeysockets/baileys");

const p = require("pino");
const qrcode = require("qrcode-terminal");
const sharp = require("sharp");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegPath = require("ffmpeg-static");
const fs = require("fs");
const os = require("os");
const path = require("path");

ffmpeg.setFfmpegPath(ffmpegPath);

const logger = p({ level: "silent" });

const PREFIX = ".";
const BOT_NAME = "BOWABOT";
const OWNER_NAME = "BOWAK";
const OWNER_NUMBER = "Rahasia bego";

const BLACKLIST = [
    "anjing",
    "kontol",
    "nigga",
    "negro",
    "ireng",
    "jawir",
    "memek",
    "anjeng",
    "jancok",
    "babik",
    "ngentod",
    "asu",
    "njing",
    "bajingan",
    "bangsat",
    "bgst",
    "tempek",
    "taik",
    "tolol",
    "tai",
];

const warnings = new Map();

const QUOTES = [
    "Jangan menyerah, awal memang selalu sulit.",
    "Sukses dimulai dari langkah kecil hari ini.",
    "Gagal bukan berarti berakhir, tapi awal dari belajar.",
    "Tetap rendah hati saat berhasil, tetap semangat saat gagal.",
    "Waktu tidak akan menunggu siapa pun, gunakan dengan baik.",
    "Kegagalan adalah guru terbaik yang jarang disadari.",
    "Bermimpilah besar, tapi mulai dari hal kecil.",
    "Kamu lebih kuat dari yang kamu kira.",
    "Setiap hari adalah kesempatan untuk menjadi lebih baik.",
    "Sabar itu pahit, tapi buahnya manis.",
    "kontolodon 😹"
];



function getText(message) {
    const m = message.message;

    return (
        m?.conversation ||
        m?.extendedTextMessage?.text ||
        m?.imageMessage?.caption ||
        m?.videoMessage?.caption ||
        m?.viewOnceMessage?.message?.imageMessage?.caption ||
        m?.viewOnceMessage?.message?.videoMessage?.caption ||
        ""
    );
}

function getContentType(m) {
    if (m?.imageMessage) return "image";
    if (m?.videoMessage) return "video";
    if (m?.stickerMessage) return "sticker";
    if (m?.audioMessage) return "audio";

    return null;
}

function getMediaMessage(message, wantedType) {
    const m = message.message;
    const direct = m?.viewOnceMessage?.message || m;

    if (getContentType(direct) === wantedType) {
        return { msg: message };
    }

    const quotedContent =
        m?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (quotedContent) {
        const unwrapped =
            quotedContent?.viewOnceMessage?.message || quotedContent;

        if (getContentType(unwrapped) === wantedType) {
            return {
                msg: {
                    key: {
                        remoteJid: message.key.remoteJid,
                        id: m.extendedTextMessage.contextInfo.stanzaId,
                    },
                    message: unwrapped,
                },
            };
        }
    }

    return null;
}


async function downloadMedia(msg) {
    return downloadMediaMessage(msg, "buffer", {}, {
        logger,
        reuploadRequest: sock.updateMediaMessage,
    });
}

async function reply(sock, message, text) {
    await sock.sendMessage(
        message.key.remoteJid,
        { text },
        { quoted: message }
    );
}


function normalizeText(text) {
    return text
        .toLowerCase()
        .normalize("NFKC")
        .replace(/\s+/g, " ")
        .trim();
}


function containsBlacklist(text) {
    const normalized = normalizeText(text);

    return BLACKLIST.some((word) => {
        return normalized.includes(word);
    });
}


function getWarningCount(groupJid, userJid) {
    const key = `${groupJid}:${userJid}`;

    return warnings.get(key) || 0;
}


function addWarning(groupJid, userJid) {
    const key = `${groupJid}:${userJid}`;

    const current = getWarningCount(groupJid, userJid);

    const newCount = current + 1;

    warnings.set(key, newCount);

    return newCount;
}


function resetWarning(groupJid, userJid) {
    const key = `${groupJid}:${userJid}`;

    warnings.delete(key);
}


const COMMANDS = [
    {
        name: "ping",
        desc: "Cek bot online",

        handler: async ({ sock, message }) => {
            await reply(sock, message, "Hello World!");
        },
    },

    {
        name: "kon",
        desc: "Tes perintah",

        handler: async ({ sock, message }) => {
            await reply(sock, message, "tol");
        },
    },

    {
        name: "menu",
        desc: "Menampilkan daftar perintah",

        handler: async ({ sock, message }) => {
            const list = COMMANDS
                .map((c, i) => `${i + 1}. *${PREFIX}${c.name}* - ${c.desc}`)
                .join("\n");

            const text =
                `*${BOT_NAME}*\n\n` +
                `Halo, *${message.pushName || "kawan"}*!\n` +
                `Bot aktif dan siap membantu. Berikut daftar perintahnya:\n\n` +
                `*DAFTAR MENU*\n` +
                `${list}\n\n` +
                `_© ${BOT_NAME}_`;

            await reply(sock, message, text);
        },
    },

    {
        name: "owner",
        desc: "Menampilkan info pemilik bot",

        handler: async ({ sock, message }) => {
            const text =
                `*${BOT_NAME}*\n\n` +
                `Pemilik: *${OWNER_NAME}*\n` +
                `Nomor: ${OWNER_NUMBER}\n\n` +
                `Untuk pertanyaan atau kerjasama, hubungi pemilik di atas.`;

            await reply(sock, message, text);
        },
    },

    {
        name: "say",
        desc: "Bot mengulang teks yang kamu kirim",

        handler: async ({ sock, message, args }) => {
            if (!args) {
                return reply(
                    sock,
                    message,
                    `Contoh: *${PREFIX}say halo dunia*`
                );
            }

            await reply(sock, message, args);
        },
    },

    {
        name: "quote",
        desc: "Mengirim kata-kata motivasi random",

        handler: async ({ sock, message }) => {
            const quote =
                QUOTES[Math.floor(Math.random() * QUOTES.length)];

            await reply(sock, message, `"${quote}"`);
        },
    },

    {
        name: "stiker",
        desc: "Ubah gambar menjadi stiker",

        handler: async ({ sock, message }) => {
            const media = getMediaMessage(message, "image");

            if (!media) {
                return reply(
                    sock,
                    message,
                    `Kirim foto dengan caption *${PREFIX}stiker*, atau reply foto dengan perintah ini.`
                );
            }

            const buffer = await downloadMedia(media.msg);

            const webp = await sharp(buffer)
                .resize(512, 512, {
                    fit: "contain",
                    background: {
                        r: 0,
                        g: 0,
                        b: 0,
                        alpha: 0
                    }
                })
                .webp()
                .toBuffer();

            await sock.sendMessage(
                message.key.remoteJid,
                { sticker: webp },
                { quoted: message }
            );
        },
    },

    {
        name: "toimg",
        desc: "Ubah stiker menjadi gambar",

        handler: async ({ sock, message }) => {
            const media = getMediaMessage(message, "sticker");

            if (!media) {
                return reply(
                    sock,
                    message,
                    `Reply stiker yang ingin diubah dengan perintah *${PREFIX}toimg*.`
                );
            }

            const buffer = await downloadMedia(media.msg);

            const png = await sharp(buffer)
                .png()
                .toBuffer();

            await sock.sendMessage(
                message.key.remoteJid,
                { image: png },
                { quoted: message }
            );
        },
    },

    {
        name: "stikergif",
        desc: "Ubah video menjadi stiker animasi",

        handler: async ({ sock, message }) => {
            const media = getMediaMessage(message, "video");

            if (!media) {
                return reply(
                    sock,
                    message,
                    `Reply video dengan perintah *${PREFIX}stikergif*.`
                );
            }

            const buffer = await downloadMedia(media.msg);

            const tempVideo = path.join(
                os.tmpdir(),
                `bowabot_video_${Date.now()}.mp4`
            );

            const tempWebp = path.join(
                os.tmpdir(),
                `bowabot_sticker_${Date.now()}.webp`
            );

            fs.writeFileSync(tempVideo, buffer);

            try {
                await new Promise((resolve, reject) => {
                    ffmpeg(tempVideo)
                        .output(tempWebp)
                        .outputOptions([
                            "-vf",
                            "scale='min(512,iw)':min'(512,ih)':force_original_aspect_ratio=decrease,fps=15,pad=512:512:-1:-1:color=white@0.0,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse",
                            "-loop",
                            "0",
                            "-c:v",
                            "libwebp",
                        ])
                        .on("end", resolve)
                        .on("error", reject)
                        .run();
                });

                const webp = fs.readFileSync(tempWebp);

                await sock.sendMessage(
                    message.key.remoteJid,
                    { sticker: webp },
                    { quoted: message }
                );

            } finally {
                if (fs.existsSync(tempVideo)) {
                    fs.unlinkSync(tempVideo);
                }

                if (fs.existsSync(tempWebp)) {
                    fs.unlinkSync(tempWebp);
                }
            }
        },
    },
];


const commandMap = Object.fromEntries(
    COMMANDS.map((c) => [c.name, c])
);


let sock = null;


async function startBot() {

    const { state, saveCreds } =
        await useMultiFileAuthState("./session");

    sock = makeWASocket({
        auth: state,
        logger,
    });


    sock.ev.on("creds.update", saveCreds);


    sock.ev.on(
        "connection.update",
        ({ connection, lastDisconnect, qr }) => {

            if (qr) {
                console.log("Scan QR ini dengan WhatsApp:");

                qrcode.generate(qr, {
                    small: true
                });
            }


            if (connection === "open") {
                console.log("Bot berhasil terhubung...");
            }


            if (connection === "close") {

                const statusCode =
                    lastDisconnect?.error?.output?.statusCode;

                console.log("Bot koneksi terputus");


                if (statusCode === DisconnectReason.loggedOut) {

                    console.log(
                        "Sesi tidak valid, menghapus session dan meminta scan ulang..."
                    );

                    fs.rmSync("./session", {
                        recursive: true,
                        force: true
                    });

                    startBot();

                    return;
                }


                console.log("Mencoba menghubungkan kembali...");

                startBot();
            }
        }
    );


    sock.ev.on(
        "messages.upsert",
        async ({ messages }) => {

            const message = messages[0];


            if (!message.message) return;

            if (message.key.fromMe) return;


            const text = getText(message);

            const isGroup =
                message.key.remoteJid?.endsWith("@g.us");


            if (isGroup && text) {

                const groupJid =
                    message.key.remoteJid;

                const sender =
                    message.key.participant;


                if (sender) {

                    try {

                        const groupMetadata =
                            await sock.groupMetadata(groupJid);


                        const senderInfo =
                            groupMetadata.participants.find(
                                (participant) =>
                                    participant.id === sender
                            );



                        const isAdmin =
                            senderInfo?.admin === "admin" ||
                            senderInfo?.admin === "superadmin";


                        if (
                            !isAdmin &&
                            containsBlacklist(text)
                        ) {

                            const warning =
                                addWarning(
                                    groupJid,
                                    sender
                                );


                            try {

                                await sock.sendMessage(
                                    groupJid,
                                    {
                                        delete: message.key
                                    }
                                );

                                console.log(
                                    `[SECURITY] Pesan dari ${sender} dihapus. Warning ${warning}/3`
                                );

                            } catch (deleteError) {

                                console.error(
                                    "[SECURITY] Gagal menghapus pesan:",
                                    deleteError
                                );
                            }


                            if (warning <= 3) {

                                await sock.sendMessage(
                                    groupJid,
                                    {
                                        text:
                                            `🚨 *BAD WORD DETECTED*\n\n` +
                                            `@${sender.split("@")[0]}\n` +
                                            `Pesan kamu mengandung kata yang dilarang.\n\n` +
                                            `⚠️ Peringatan *${warning}/3*\n\n` +
                                            `Harap gunakan bahasa yang sesuai di grup.`,
                                        mentions: [sender]
                                    }
                                );

                            }


                            if (warning > 3) {

                                await sock.sendMessage(
                                    groupJid,
                                    {
                                        text:
                                            `🚨 *BAD WORD DETECTED*\n\n` +
                                            `@${sender.split("@")[0]}\n` +
                                            `Batas pelanggaran telah terlampaui.\n\n` +
                                            `⚠️ Peringatan: *${warning}*\n` +
                                            `👢 User akan dikeluarkan dari grup.`,
                                        mentions: [sender]
                                    }
                                );


                                try {

                                    await sock.groupParticipantsUpdate(
                                        groupJid,
                                        [sender],
                                        "remove"
                                    );


                                    console.log(
                                        `[SECURITY] ${sender} dikeluarkan dari grup.`
                                    );

                                    resetWarning(
                                        groupJid,
                                        sender
                                    );

                                } catch (kickError) {

                                    console.error(
                                        "[SECURITY] Gagal mengeluarkan user:",
                                        kickError
                                    );


                                    await sock.sendMessage(
                                        groupJid,
                                        {
                                            text:
                                                `❌ @${sender.split("@")[0]} melewati batas pelanggaran, tetapi bot gagal mengeluarkan user.\n\n` +
                                                `Pastikan bot adalah *admin grup*.`,
                                            mentions: [sender]
                                        }
                                    );
                                }
                            }


                            return;
                        }
                    } catch (securityError) {

                        console.error(
                            "[SECURITY] Error:",
                            securityError
                        );
                    }
                }
            }

            if (!text || !text.startsWith(PREFIX)) {
                return;
            }


            const parts =
                text
                    .slice(PREFIX.length)
                    .trim()
                    .split(/ +/);


            const command =
                parts[0].toLowerCase();


            const args =
                parts
                    .slice(1)
                    .join(" ");


            const cmd =
                commandMap[command];


            if (!cmd) return;


            try {

                await cmd.handler({
                    sock,
                    message,
                    args
                });

            } catch (error) {

                console.error(
                    "Error saat menjalankan perintah:",
                    error
                );


                await reply(
                    sock,
                    message,
                    "Terjadi kesalahan saat menjalankan perintah. Coba lagi."
                );
            }
        }
    );
}

startBot();