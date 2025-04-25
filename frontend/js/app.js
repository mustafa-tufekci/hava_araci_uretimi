// API URL'i
const API_URL = "http://localhost:8080/api";

// Local storage'dan token'ı al
const getToken = () => localStorage.getItem("token");

// Local storage'dan kullanıcı bilgilerini al
const getUserInfo = () => JSON.parse(localStorage.getItem("userInfo"));

// Kullanıcı girişi yapılmış mı kontrol et
const isAuthenticated = () => {
    return getToken() !== null;
};

// Giriş durumuna göre login sayfası veya ana içeriği göster
function checkAuth() {
    if (isAuthenticated()) {
        $("#login-container").hide();
        $("#main-container").show();
        
        // Kullanıcı bilgilerini göster
        const userInfo = getUserInfo();
        if (userInfo) {
            if (userInfo.takim === null && userInfo.is_superuser === true) {
                $("#user-info").text(`${userInfo.first_name} ${userInfo.last_name} - Admin`);
                $("#nav-personel").text("Personeller");
            } else {
                $("#user-info").text(`${userInfo.first_name} ${userInfo.last_name} - ${userInfo.takim}`);
                $("#nav-personel").text("Takım Üyeleri");
            }
            
            // Takımlar menüsünü sadece superuser için göster
            if (userInfo.is_superuser) {
                $("#nav-takimlar").show();
            } else {
                $("#nav-takimlar").hide();
            }
            
            // Uçaklar menüsünü sadece superuser ve montaj takımı için göster
            if (userInfo.is_superuser || userInfo.takim_tipi === "MONTAJ") {
                $("#nav-ucaklar").show();
            } else {
                $("#nav-ucaklar").hide();
            }
        }
        
        // Varsayılan içeriği yükle
        if (userInfo.is_superuser) {
            loadContent("takimlar"); // Superuser için varsayılan içerik
        } else {
            loadContent("personel"); // Diğer kullanıcılar için varsayılan içerik
        }
    } else {
        $("#main-container").hide();
        $("#login-container").show();
    }
}

// Login form gönderimini işle
$("#login-form").submit(function (e) {
    e.preventDefault();
  const username = $("#username").val();
  const password = $("#password").val();

    $.ajax({
        url: `${API_URL}/token/`,
    type: "POST",
        data: {
            username: username,
      password: password,
        },
    success: function (data) {
      localStorage.setItem("token", data.access);
      localStorage.setItem("userInfo", JSON.stringify(data.user));
            checkAuth();
        },
    error: function (xhr) {
      alert("Login failed. Please check your credentials.");
            console.error(xhr.responseText);
    },
    });
});

// Çıkış işlemini gerçekleştir
function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("userInfo");
    checkAuth();
}

// Seçilen menüye göre içeriği yükle
function loadContent(page) {
    // Kullanıcı bilgilerini kontrol et
    const userInfo = getUserInfo();
    
    // Takımlar sayfası kontrolü
    if (page === "takimlar" && (!userInfo || !userInfo.is_superuser)) {
        page = "personel"; // Varsayılan sayfaya yönlendir
    }
    
    // Uçaklar sayfası kontrolü
    if (
        page === "ucaklar" &&
        (!userInfo || (!userInfo.is_superuser && userInfo.takim_tipi !== "MONTAJ"))
    ) {
        page = "personel"; // Varsayılan sayfaya yönlendir
    }

    // Aktif menü öğesini güncelle
    $(".nav-link").removeClass("active");
    $(`#nav-${page}`).addClass("active");

    // İçerik alanını temizle
    const contentArea = $("#content-area");
    contentArea.empty();
    
    // Mevcut DataTable örneği varsa kaldır
    if ($.fn.DataTable.isDataTable("#dataTable")) {
        $("#dataTable").DataTable().destroy();
    }

    // Sayfaya göre uygun içeriği göster
    switch (page) {
        case "takimlar":
            contentArea.html(generateTeamTableHTML());
            initializeDataTable(
                "/takimlar/",
                getColumnsForPage("takimlar"),
                "dataTable"
            );
            setupTakimEventHandlers();
            break;
        case "personel":
            contentArea.html(generatePersonelTableHTML());
            initializeDataTable(
                "/personel/",
                getColumnsForPage("personel"),
                "dataTable"
            );
            setupPersonelEventHandlers();
            break;
        case "ucak-modelleri":
            contentArea.html(generateModelTableHTML());
            initializeDataTable(
                "/ucak-modelleri/",
                getColumnsForPage("ucak-modelleri"),
                "dataTable"
            );
            setupModelEventHandlers();
            break;
        case "parcalar":
            contentArea.html(generateParcaTableHTML());
            initializeDataTable(
                "/parcalar/",
                getColumnsForPage("parcalar"),
                "dataTable"
            );
            setupParcaEventHandlers();
            break;
        case "ucaklar":
            contentArea.html(generateUcakTableHTML());
            initializeDataTable(
                "/ucaklar/",
                getColumnsForPage("ucaklar"),
                "dataTable"
            );
            setupUcakEventHandlers();
            break;
    }
}

// DataTables hata ayıklama için hata işlemeyi etkinleştir
$.fn.dataTable.ext.errMode = "throw";

// Server-side işleme ile DataTable'ı başlat
function initializeDataTable(endpoint, columns, tableId) {
    const tableSelector = `#${tableId}`;
    console.log(`Initializing DataTable for selector: ${tableSelector}`);
    
    if (!$(tableSelector).length) {
        console.error(
            `Table element with selector ${tableSelector} not found in DOM`
        );
        return;
    }
    
    $(tableSelector).DataTable({
        processing: true,
        serverSide: true,
        ajax: {
            url: API_URL + endpoint + "?format=datatables",
            type: "GET",
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", "Bearer " + getToken());
            },
            error: function (xhr, error, thrown) {
                console.error("DataTables error:", error, thrown);
                console.log("Server response:", xhr.responseText);
            },
            dataSrc: function (json) {
                console.log("API Response:", json);
                // Handle both formats: direct data or data inside results
                if (json.data) {
                    return json.data;
                } else if (json.results) {
                    return json.results;
                } else {
                    return [];
            }
        },
        },
        columns: columns,
    });
}

// Farklı sayfalar için sütun yapılandırmalarını al
function getColumnsForPage(page) {
    const getEditDeleteButtons = (entityType) => {
        const userInfo = getUserInfo();
        const isAuthorized =
            userInfo &&
            userInfo.takim_tipi &&
            userInfo.takim_tipi !== "MONTAJ" &&
            userInfo.takim_tipi !== "AVIYONIK" &&
            userInfo.takim_tipi !== "KUYRUK" &&
            userInfo.takim_tipi !== "GOVDE" &&
            userInfo.takim_tipi !== "KANAT";

        return {
            data: null,
            orderable: false,
            searchable: false,
            render: function (data, type, row) {
                let buttons = "";
                
                // Add edit button for all entities except parca, model and personel
                if (
                    entityType !== "parca" &&
                    entityType !== "model" &&
                    entityType !== "personel"
                ) {
                    buttons += `
                        <button class="btn btn-sm btn-primary edit-${entityType}-btn" data-id="${row.id}">Düzenle</button>
                        <button class="btn btn-sm btn-danger delete-${entityType}-btn" data-id="${row.id}">Sil</button>
                    `;
                }
                
                // Add edit button for model only if authorized
                if (entityType === "model" && isAuthorized) {
                    buttons += `
                        <button class="btn btn-sm btn-primary edit-${entityType}-btn" data-id="${row.id}">Düzenle</button>
                    `;
                }
                
                // Add recycle button for parts that are not used and user is not from montaj team
                if (
                    entityType === "parca" &&
                    !row.kullanildi &&
                    userInfo &&
                    userInfo.takim_tipi !== "MONTAJ"
                ) {
                    buttons += `
                        <button class="btn btn-sm btn-warning recycle-${entityType}-btn" data-id="${row.id}">Geri Dönüşüm</button>
                    `;
                }
                
                return buttons;
            },
        };
    };

    switch (page) {
        case "takimlar":
            return [
                { data: "id", name: "id" },
                { data: "ad", name: "ad" },
                { data: "tip", name: "tip" },
                { data: "aciklama", name: "aciklama" },
                getEditDeleteButtons("takim"),
            ];
        case "personel":
            return [
                { data: "username", name: "username" },
                { data: "first_name", name: "first_name" },
                { data: "last_name", name: "last_name" },
                { data: "email", name: "email" },
                { data: "takim", name: "takim", defaultContent: "-" },
            ];
        case "ucak-modelleri":
            const userInfo = getUserInfo();
            const isSuperuser = userInfo && userInfo.is_superuser;
            
            const columns = [
                { data: "model", name: "model" },
                { data: "aciklama", name: "aciklama" },
            ];
            
            if (isSuperuser) {
                columns.push(getEditDeleteButtons("model"));
            }
            
            return columns;
        case "parcalar":
            const parcaUserInfo = getUserInfo();
            const isMontajTeam =
                parcaUserInfo && parcaUserInfo.takim_tipi === "MONTAJ";
            
            const parcaColumns = [
                { data: "id", name: "id" },
                { data: "seri_no", name: "seri_no" },
                { data: "tip", name: "tip" },
                { data: "ucak_modeli", name: "ucak_modeli" },
                { data: "uretim_takimi", name: "uretim_takimi" },
                { data: "created_by", name: "created_by" },
                { data: "kullanildi", name: "kullanildi" },
            ];
            
            if (!isMontajTeam) {
                parcaColumns.push(getEditDeleteButtons("parca"));
            }
            
            return parcaColumns;
        case "ucaklar":
            return [
                { data: "seri_no", name: "seri_no" },
                { data: "model", name: "model" },
                { data: "montaj_takimi", name: "montaj_takimi" },
                { data: "durum", name: "durum" },
                { data: "montaj_tarihi", name: "montaj_tarihi" },
                { 
                    data: "kullanilan_parcalar",
                    name: "kullanilan_parcalar",
                    render: function (data, type, row) {
                        if (!data || data.length === 0) return "-";
                        return `<button class="btn btn-sm btn-info view-parts-btn" data-id="${row.id}">Parçaları Görüntüle</button>`;
                    },
                },
            ];
    }
}

// Takım tablosu için HTML oluştur
function generateTeamTableHTML() {
    return `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2>Takımlar</h2>
            <button class="btn btn-success" id="add-team-btn">Yeni Takım Ekle</button>
        </div>
        <table id="dataTable" class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Ad</th>
                    <th>Tip</th>
                    <th>Açıklama</th>
                    <th>İşlemler</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}

// Personel tablosu için HTML oluştur
function generatePersonelTableHTML() {
    const userInfo = getUserInfo();
    const isSuperuser = userInfo && userInfo.is_superuser;
    
    return `
        <div class="d-flex justify-content-between align-items-center mb-3">
            ${
                isSuperuser
                    ? `
            <h2>Personeller</h2>
                    <button class="btn btn-success" id="add-personel-btn">Yeni Personel Ekle</button>`
                    : `<h2>Takım Üyeleri</h2>`
            }
        </div>
        <table id="dataTable" class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>Kullanıcı Adı</th>
                    <th>Ad</th>
                    <th>Soyad</th>
                    <th>Email</th>
                    <th>Takım</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}

// Uçak modeli tablosu için HTML oluştur
function generateModelTableHTML() {
    const userInfo = getUserInfo();
    const isSuperuser = userInfo && userInfo.is_superuser;

    return `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2>Uçak Modelleri</h2>
            ${
                isSuperuser
                    ? '<button class="btn btn-success" id="add-model-btn">Yeni Model Ekle</button>'
                    : ""
            }
        </div>
        <table id="dataTable" class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>Model</th>
                    <th>Açıklama</th>
                    ${isSuperuser ? "<th>İşlemler</th>" : ""}
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}

// Parça tablosu için HTML oluştur
function generateParcaTableHTML() {
    const userInfo = getUserInfo();
    const isMontajTeam = userInfo && userInfo.takim_tipi === "MONTAJ";
    
    return `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2>Parçalar</h2>
            ${
                !isMontajTeam
                    ? '<button class="btn btn-success" id="add-parca-btn">Yeni Parça Ekle</button>'
                    : ""
            }
        </div>
        <table id="dataTable" class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Seri No</th>
                    <th>Tip</th>
                    <th>Uçak Modeli</th>
                    <th>Üretim Takımı</th>
                    <th>Üreten</th>
                    <th>Kullanıldı</th>
                    ${!isMontajTeam ? "<th>İşlemler</th>" : ""}
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}

// Uçak tablosu için HTML oluştur
function generateUcakTableHTML() {
    return `
        <div class="d-flex justify-content-between align-items-center mb-3">
            <h2>Uçaklar</h2>
            <button class="btn btn-success" id="add-ucak-btn">Yeni Uçak Montajı</button>
        </div>
        <table id="dataTable" class="table table-striped table-bordered">
            <thead>
                <tr>
                    <th>Seri No</th>
                    <th>Model</th>
                    <th>Montaj Takımı</th>
                    <th>Durum</th>
                    <th>Montaj Tarihi</th>
                    <th>Kullanılan Parçalar</th>
                </tr>
            </thead>
            <tbody></tbody>
        </table>
    `;
}

// Farklı varlıklar için olay işleyicilerini ayarla
function setupTakimEventHandlers() {
    // Ekle butonu
    $("#add-team-btn").on("click", function () {
        openTakimModal();
    });
    
    // Düzenle butonları
    $("#dataTable").on("click", ".edit-takim-btn", function () {
        const id = $(this).data("id");
        openTakimModal(id);
    });
    
    // Sil butonları
    $("#dataTable").on("click", ".delete-takim-btn", function () {
        const id = $(this).data("id");
        if (confirm("Bu takımı silmek istediğinize emin misiniz? Bu işlem geri alınamaz!")) {
            deleteTakim(id);
        }
    });
}

function setupPersonelEventHandlers() {
    // Ekle butonu
    $("#add-personel-btn").on("click", function () {
        openPersonelModal();
    });
}

function setupModelEventHandlers() {
    // Ekle butonu
    $("#add-model-btn").on("click", function () {
        openModelModal();
    });
    
    // Düzenle butonları
    $("#dataTable").on("click", ".edit-model-btn", function () {
        const id = $(this).data("id");
        openModelModal(id);
    });
    
    // Sil butonları
    $("#dataTable").on("click", ".delete-model-btn", function () {
        const id = $(this).data("id");
        if (confirm("Bu uçak modelini silmek istediğinize emin misiniz?")) {
            deleteModel(id);
        }
    });
}

function setupParcaEventHandlers() {
    // Ekle butonu
    $("#add-parca-btn").on("click", function () {
        openParcaModal();
    });
    
    // Düzenle butonları
    $("#dataTable").on("click", ".edit-parca-btn", function () {
        const id = $(this).data("id");
        openParcaModal(id);
    });
    
    // Geri dönüşüm butonları
    $("#dataTable").on("click", ".recycle-parca-btn", function () {
        const id = $(this).data("id");
        if (
            confirm("Bu parçayı geri dönüşüme göndermek istediğinize emin misiniz?")
        ) {
            recycleParca(id);
        }
    });
}

function setupUcakEventHandlers() {
    // Ekle butonu
    $("#add-ucak-btn").on("click", function () {
        openUcakModal();
    });
    
    // Düzenle butonları
    $("#dataTable").on("click", ".edit-ucak-btn", function () {
        const id = $(this).data("id");
        openUcakModal(id);
    });
    
    // Parça görüntüle butonları
    $("#dataTable").on("click", ".view-parts-btn", function () {
        const id = $(this).data("id");
        showUcakParts(id);
    });
    
    // Sil butonları
    $("#dataTable").on("click", ".delete-ucak-btn", function () {
        const id = $(this).data("id");
        if (confirm("Bu uçağı silmek istediğinize emin misiniz?")) {
            deleteUcak(id);
        }
    });
}

// Modal form işleme işlevleri
function openTakimModal(id = null) {
    const isEdit = id !== null;
    const modalTitle = isEdit ? "Takım Düzenle" : "Yeni Takım Ekle";
    $("#modalTitle").text(modalTitle);
    
    // Önceki formu temizle
    $("#modalBody").empty();
    
    // Form HTML oluştur
    const formHtml = `
        <form id="takim-form">
            <input type="hidden" id="takim-id" value="${id || ""}">
            <div class="mb-3">
                <label for="takim-ad" class="form-label">Takım Adı</label>
                <input type="text" class="form-control" id="takim-ad" required>
            </div>
            <div class="mb-3">
                <label for="takim-tip" class="form-label">Takım Tipi</label>
                <select class="form-select" id="takim-tip" required>
                    <option value="">Seçiniz</option>
                    <option value="KANAT">Kanat Takımı</option>
                    <option value="GOVDE">Gövde Takımı</option>
                    <option value="KUYRUK">Kuyruk Takımı</option>
                    <option value="AVIYONIK">Aviyonik Takımı</option>
                    <option value="MONTAJ">Montaj Takımı</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="takim-aciklama" class="form-label">Açıklama</label>
                <textarea class="form-control" id="takim-aciklama" rows="3"></textarea>
            </div>
        </form>
    `;
    
    $("#modalBody").html(formHtml);
    
    // Düzenleme durumunda, form verilerini al ve doldur
    if (isEdit) {
        $.ajax({
            url: `${API_URL}/takimlar/${id}/`,
            type: "GET",
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", "Bearer " + getToken());
            },
            success: function (data) {
                $("#takim-id").val(data.id);
                $("#takim-ad").val(data.ad);
                $("#takim-tip").val(data.tip);
                $("#takim-aciklama").val(data.aciklama);
            },
            error: function (xhr) {
                alert("Takım bilgileri alınamadı.");
                console.error(xhr.responseText);
            },
        });
    }
    
    // Kaydet butonu işleyicisini ayarla
    $("#saveEntityBtn")
        .off("click")
        .on("click", function () {
        saveTakim();
    });
    
    // Modalı göster
    $("#entityModal").modal("show");
}

// Takım verilerini kaydet
function saveTakim() {
    const id = $("#takim-id").val();
    const isEdit = id !== "";
    
    const data = {
        ad: $("#takim-ad").val(),
        tip: $("#takim-tip").val(),
        aciklama: $("#takim-aciklama").val(),
    };
    
    $.ajax({
        url: isEdit ? `${API_URL}/takimlar/${id}/` : `${API_URL}/takimlar/`,
        type: isEdit ? "PUT" : "POST",
        contentType: "application/json",
        data: JSON.stringify(data),
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            $("#entityModal").modal("hide");
            refreshCurrentTable();
        },
        error: function (xhr) {
            let errorMessage = "İşlem başarısız.";

            try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    errorMessage = response.error;
                } else if (response.non_field_errors) {
                    errorMessage = response.non_field_errors.join("\n");
                } else if (response.detail) {
                    errorMessage = response.detail;
                } else {
                    const errors = [];
                    for (const field in response) {
                        if (Array.isArray(response[field])) {
                            errors.push(`${field}: ${response[field].join("\n")}`);
                        }
                    }
                    if (errors.length > 0) {
                        errorMessage = errors.join("\n");
                    }
                }
            } catch (e) {
                console.error("Hata mesajı işlenirken bir sorun oluştu:", e);
            }

            alert(errorMessage);
            console.error(xhr.responseText);
        },
    });
}

// Takımı sil
function deleteTakim(id) {
    $.ajax({
        url: `${API_URL}/takimlar/${id}/`,
        type: "DELETE",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            refreshCurrentTable();
        },
        error: function (xhr) {
            let errorMessage = "Silme işlemi başarısız.";

            try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    errorMessage = response.error;
                } else if (response.non_field_errors) {
                    errorMessage = response.non_field_errors.join("\n");
                } else if (response.detail) {
                    errorMessage = response.detail;
                } else {
                    const errors = [];
                    for (const field in response) {
                        if (Array.isArray(response[field])) {
                            errors.push(`${field}: ${response[field].join("\n")}`);
                        }
                    }
                    if (errors.length > 0) {
                        errorMessage = errors.join("\n");
                    }
                }
            } catch (e) {
                console.error("Hata mesajı işlenirken bir sorun oluştu:", e);
            }

            alert(errorMessage);
            console.error(xhr.responseText);
        },
    });
}

// Refresh current table
function refreshCurrentTable() {
    if ($.fn.DataTable.isDataTable("#dataTable")) {
        $("#dataTable").DataTable().ajax.reload();
    }
}

// Modal form işleme işlevleri
function openPersonelModal(id = null) {
    const isEdit = id !== null;
    const modalTitle = isEdit ? "Personel Düzenle" : "Yeni Personel Ekle";
    $("#modalTitle").text(modalTitle);
    
    // Önceki formu temizle
    $("#modalBody").empty();
    
    // Takımları dropdown için al
    $.ajax({
        url: `${API_URL}/takimlar/`,
        type: "GET",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function (data) {
            const teams = data.results || data;
            
            // Form HTML oluştur
            const formHtml = `
                <form id="personel-form">
                    <input type="hidden" id="personel-id" value="${id || ""}">
                    <div class="mb-3">
                        <label for="personel-username" class="form-label">Kullanıcı Adı</label>
                        <input type="text" class="form-control" id="personel-username" required>
                    </div>
                    <div class="mb-3">
                        <label for="personel-first-name" class="form-label">Ad</label>
                        <input type="text" class="form-control" id="personel-first-name" required>
                    </div>
                    <div class="mb-3">
                        <label for="personel-last-name" class="form-label">Soyad</label>
                        <input type="text" class="form-control" id="personel-last-name" required>
                    </div>
                    <div class="mb-3">
                        <label for="personel-email" class="form-label">Email</label>
                        <input type="email" class="form-control" id="personel-email" required>
                    </div>
                    ${
                        !isEdit
                            ? `
                    <div class="mb-3">
                        <label for="personel-password" class="form-label">Şifre</label>
                        <input type="password" class="form-control" id="personel-password" required>
                    </div>`
                            : ""
                    }
                    <div class="mb-3">
                        <label for="personel-takim" class="form-label">Takım</label>
                        <select class="form-select" id="personel-takim" required>
                            <option value="">Seçiniz</option>
                            ${teams
                                .map(
                                    (team) =>
                                        `<option value="${team.id}">${team.ad} (${team.tip})</option>`
                                )
                                .join("")}
                        </select>
                    </div>
                </form>
            `;
            
            $("#modalBody").html(formHtml);
            
            // Düzenleme durumunda, form verilerini al ve doldur
            if (isEdit) {
                $.ajax({
                    url: `${API_URL}/personel/${id}/`,
                    type: "GET",
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader("Authorization", "Bearer " + getToken());
                    },
                    success: function (data) {
                        $("#personel-username").val(data.username);
                        $("#personel-first-name").val(data.first_name);
                        $("#personel-last-name").val(data.last_name);
                        $("#personel-email").val(data.email);
                        $("#personel-takim").val(data.takim_id);
                    },
                    error: function (xhr) {
                        alert("Personel bilgileri alınamadı.");
                        console.error(xhr.responseText);
                    },
                });
            }
            
            // Kaydet butonu işleyicisini ayarla
            $("#saveEntityBtn")
                .off("click")
                .on("click", function () {
                savePersonel();
            });
            
            // Modalı göster
            $("#entityModal").modal("show");
        },
        error: function (xhr) {
            alert("Takımlar alınamadı.");
            console.error(xhr.responseText);
        },
    });
}

// Personel verilerini kaydet
function savePersonel() {
    const data = {
        username: $("#personel-username").val(),
        first_name: $("#personel-first-name").val(),
        last_name: $("#personel-last-name").val(),
        email: $("#personel-email").val(),
        takim: $("#personel-takim").val(),
        password: $("#personel-password").val(),
    };
    
    $.ajax({
        url: `${API_URL}/personel/`,
        type: "POST",
        contentType: "application/json",
        data: JSON.stringify(data),
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            $("#entityModal").modal("hide");
            refreshCurrentTable();
        },
        error: function (xhr) {
            let errorMessage = "İşlem başarısız.";
            
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    errorMessage = response.error;
                } else if (response.non_field_errors) {
                    errorMessage = response.non_field_errors.join("\n");
                } else if (response.detail) {
                    errorMessage = response.detail;
                } else {
                    const errors = [];
                    for (const field in response) {
                        if (Array.isArray(response[field])) {
                            errors.push(response[field].join("\n"));
                        }
                    }
                    if (errors.length > 0) {
                        errorMessage = errors.join("\n");
                    }
                }
            } catch (e) {
                console.error("Hata mesajı işlenirken bir sorun oluştu:", e);
            }
            
            alert(errorMessage);
            console.error(xhr.responseText);
        },
    });
}

// Personeli sil
function deletePersonel(id) {
    $.ajax({
        url: `${API_URL}/personel/${id}/`,
        type: "DELETE",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            refreshCurrentTable();
        },
        error: function (xhr) {
            alert("Silme işlemi başarısız.");
            console.error(xhr.responseText);
        },
    });
}

// Modal form işleme işlevleri
function openModelModal(id = null) {
    const isEdit = id !== null;
    const modalTitle = isEdit ? "Uçak Modeli Düzenle" : "Yeni Uçak Modeli Ekle";
    $("#modalTitle").text(modalTitle);
    
    // Önceki formu temizle
    $("#modalBody").empty();
    
    // Form HTML oluştur
    const formHtml = `
        <form id="model-form">
            <input type="hidden" id="model-id" value="${id || ""}">
            <div class="mb-3">
                <label for="model-ad" class="form-label">Model Adı</label>
                <select class="form-select" id="model-ad" required>
                    <option value="">Seçiniz</option>
                    <option value="TB2">TB2</option>
                    <option value="TB3">TB3</option>
                    <option value="AKINCI">AKINCI</option>
                    <option value="KIZILELMA">KIZILELMA</option>
                </select>
            </div>
            <div class="mb-3">
                <label for="model-aciklama" class="form-label">Açıklama</label>
                <textarea class="form-control" id="model-aciklama" rows="3"></textarea>
            </div>
        </form>
    `;
    
    $("#modalBody").html(formHtml);
    
    // Düzenleme durumunda, form verilerini al ve doldur
    if (isEdit) {
        $.ajax({
            url: `${API_URL}/ucak-modelleri/${id}/`,
            type: "GET",
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", "Bearer " + getToken());
            },
            success: function (data) {
                $("#model-ad").val(data.model);
                $("#model-aciklama").val(data.aciklama);
            },
            error: function (xhr) {
                alert("Model bilgileri alınamadı.");
                console.error(xhr.responseText);
            },
        });
    }
    
    // Kaydet butonu işleyicisini ayarla
    $("#saveEntityBtn")
        .off("click")
        .on("click", function () {
        saveModel();
    });
    
    // Modalı göster
    $("#entityModal").modal("show");
}

// Uçak modeli verilerini kaydet
function saveModel() {
    const id = $("#model-id").val();
    const isEdit = id !== "";
    
    const data = {
        model: $("#model-ad").val(),
        aciklama: $("#model-aciklama").val(),
    };
    
    $.ajax({
        url: isEdit
            ? `${API_URL}/ucak-modelleri/${id}/`
            : `${API_URL}/ucak-modelleri/`,
        type: isEdit ? "PUT" : "POST",
        contentType: "application/json",
        data: JSON.stringify(data),
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            $("#entityModal").modal("hide");
            refreshCurrentTable();
        },
        error: function (xhr) {
            let errorMessage = "İşlem başarısız.";
            
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    errorMessage = response.error;
                } else if (response.non_field_errors) {
                    errorMessage = response.non_field_errors.join("\n");
                } else if (response.detail) {
                    errorMessage = response.detail;
                } else {
                    const errors = [];
                    for (const field in response) {
                        if (Array.isArray(response[field])) {
                            errors.push(`${field}: ${response[field].join("\n")}`);
                        }
                    }
                    if (errors.length > 0) {
                        errorMessage = errors.join("\n");
                    }
                }
            } catch (e) {
                console.error("Hata mesajı işlenirken bir sorun oluştu:", e);
            }
            
            alert(errorMessage);
            console.error(xhr.responseText);
        },
    });
}

// Uçak modelini sil
function deleteModel(id) {
    $.ajax({
        url: `${API_URL}/ucak-modelleri/${id}/`,
        type: "DELETE",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            refreshCurrentTable();
        },
        error: function (xhr) {
            alert("Silme işlemi başarısız.");
            console.error(xhr.responseText);
        },
    });
}

// Modal form işleme işlevleri
function openParcaModal(id = null) {
    const isEdit = id !== null;
    const modalTitle = isEdit ? "Parça Düzenle" : "Yeni Parça Ekle";
    $("#modalTitle").text(modalTitle);
    
    // Önceki formu temizle
    $("#modalBody").empty();
    
    // Dropdown verilerini al
    $.ajax({
        url: `${API_URL}/ucak-modelleri/`,
        type: "GET",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function (response) {
            // Handle both formats: direct data or data inside results
            const models = response.results || response || [];
            
            // Form HTML oluştur
            const formHtml = `
                <form id="parca-form">
                    <input type="hidden" id="parca-id" value="${id || ""}">
                    ${
                        isEdit
                            ? `
                    <div class="mb-3">
                        <label for="parca-seri-no" class="form-label">Seri No</label>
                        <input type="text" class="form-control" id="parca-seri-no" required>
                    </div>`
                            : ""
                    }
                    <div class="mb-3">
                        <label for="parca-tip" class="form-label">Parça Tipi</label>
                        <select class="form-select" id="parca-tip" required>
                            <option value="">Seçiniz</option>
                            <option value="KANAT">Kanat</option>
                            <option value="GOVDE">Gövde</option>
                            <option value="KUYRUK">Kuyruk</option>
                            <option value="AVIYONIK">Aviyonik</option>
                        </select>
                    </div>
                    <div class="mb-3">
                        <label for="parca-ucak-modeli" class="form-label">Uçak Modeli</label>
                        <select class="form-select" id="parca-ucak-modeli" required>
                            <option value="">Seçiniz</option>
                            ${models
                                .map(
                                    (model) =>
                                        `<option value="${model.id}">${model.model}</option>`
                                )
                                .join("")}
                        </select>
                    </div>
                    ${
                        isEdit
                            ? `
                    <div class="mb-3 form-check">
                        <input type="checkbox" class="form-check-input" id="parca-kullanildi">
                        <label class="form-check-label" for="parca-kullanildi">Kullanıldı</label>
                    </div>`
                            : ""
                    }
                </form>
            `;
            
            $("#modalBody").html(formHtml);
            
            // Düzenleme durumunda, form verilerini al ve doldur
            if (isEdit) {
                $.ajax({
                    url: `${API_URL}/parcalar/${id}/`,
                    type: "GET",
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader("Authorization", "Bearer " + getToken());
                    },
                    success: function (data) {
                        $("#parca-seri-no").val(data.seri_no);
                        $("#parca-tip").val(data.tip);
                        $("#parca-ucak-modeli").val(data.ucak_modeli);
                        $("#parca-kullanildi").prop("checked", data.kullanildi);
                    },
                    error: function (xhr) {
                        alert("Parça bilgileri alınamadı.");
                        console.error(xhr.responseText);
                    },
                });
            }
            
            // Kaydet butonu işleyicisini ayarla
            $("#saveEntityBtn")
                .off("click")
                .on("click", function () {
                saveParca();
            });
            
            // Modalı göster
            $("#entityModal").modal("show");
        },
        error: function () {
            alert("Uçak modelleri alınamadı.");
        },
    });
}

// Parça verilerini kaydet
function saveParca() {
    const id = $("#parca-id").val();
    const isEdit = id !== "";
    
    const data = {
        seri_no: $("#parca-seri-no").val(),
        tip: $("#parca-tip").val(),
        ucak_modeli: $("#parca-ucak-modeli").val(),
        kullanildi: $("#parca-kullanildi").is(":checked"),
    };
    
    $.ajax({
        url: isEdit ? `${API_URL}/parcalar/${id}/` : `${API_URL}/parcalar/`,
        type: isEdit ? "PUT" : "POST",
        contentType: "application/json",
        data: JSON.stringify(data),
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            $("#entityModal").modal("hide");
            refreshCurrentTable();
        },
        error: function (xhr) {
            let errorMessage = "İşlem başarısız.";
            
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    errorMessage = response.error;
                } else if (response.non_field_errors) {
                    errorMessage = response.non_field_errors.join("\n");
                } else if (response.detail) {
                    errorMessage = response.detail;
                } else {
                    const errors = [];
                    for (const field in response) {
                        if (Array.isArray(response[field])) {
                            errors.push(response[field].join("\n"));
                        }
                    }
                    if (errors.length > 0) {
                        errorMessage = errors.join("\n");
                    }
                }
            } catch (e) {
                console.error("Hata mesajı işlenirken bir sorun oluştu:", e);
            }
            
            alert(errorMessage);
            console.error(xhr.responseText);
        },
    });
}

// Parçayı geri dönüşüme göndermek
function recycleParca(id) {
    if (!id) {
        console.error("Parça ID bulunamadı");
        return;
    }

    $.ajax({
        url: `${API_URL}/parcalar/${id}/geri_donusum/`,
        type: "POST",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            refreshCurrentTable();
        },
        error: function (xhr) {
            let errorMessage = "Geri dönüşüm işlemi başarısız.";
            
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.detail) {
                    errorMessage = response.detail;
                } else if (response.error) {
                    errorMessage = response.error;
                }
            } catch (e) {
                console.error("Hata mesajı işlenirken bir sorun oluştu:", e);
            }
            
            alert(errorMessage);
            console.error(xhr.responseText);
        },
    });
}

// Modal form işleme işlevleri
function openUcakModal(id = null) {
    const isEdit = id !== null;
    const modalTitle = isEdit ? "Uçak Düzenle" : "Yeni Uçak Montajı";
    $("#modalTitle").text(modalTitle);
    
    // Önceki formu temizle
    $("#modalBody").empty();
    
    // Kullanıcı bilgilerini al
    const userInfo = getUserInfo();
    console.log("User Info:", userInfo); // Debug için
    
    // Dropdown verilerini al
    $.when(
        $.ajax({
            url: `${API_URL}/ucak-modelleri/`,
            type: "GET",
            beforeSend: function (xhr) {
                xhr.setRequestHeader("Authorization", "Bearer " + getToken());
            },
        })
    )
        .done(function (modelsResponse) {
        const models = modelsResponse.results || modelsResponse;
        
            // Form HTML oluştur
        const formHtml = `
            <form id="ucak-form">
                    <input type="hidden" id="ucak-id" value="${id || ""}">
                <div class="mb-3">
                    <label for="ucak-montaj-takimi" class="form-label">Montaj Takımı</label>
                        <input type="text" class="form-control" id="ucak-montaj-takimi-text" value="${
                            userInfo.takim
                        }" readonly>
                        <input type="hidden" id="ucak-montaj-takimi" value="${
                            userInfo.takim_id
                        }">
                </div>
                <div class="mb-3">
                    <label for="ucak-model" class="form-label">Uçak Modeli</label>
                    <select class="form-select" id="ucak-model" required>
                        <option value="">Seçiniz</option>
                            ${models
                                .map(
                                    (model) =>
                                        `<option value="${model.id}">${model.model}</option>`
                                )
                                .join("")}
                    </select>
                </div>
                <div id="parca-secim-alani" style="display: none;">
                    <h5 class="mb-3">Parça Seçimi</h5>
                    <div class="alert alert-info">
                        Tüm parça tipleri için en az bir parça seçilmelidir.
                    </div>
                    <div id="parca-kanat" class="mb-3">
                        <label class="form-label">Kanat Parçası</label>
                        <select class="form-select" id="kanat-parcasi" required>
                            <option value="">Seçiniz</option>
                        </select>
                        <div class="form-text">Stok durumu: <span class="stok-durumu">-</span></div>
                    </div>
                    <div id="parca-govde" class="mb-3">
                        <label class="form-label">Gövde Parçası</label>
                        <select class="form-select" id="govde-parcasi" required>
                            <option value="">Seçiniz</option>
                        </select>
                        <div class="form-text">Stok durumu: <span class="stok-durumu">-</span></div>
                    </div>
                    <div id="parca-kuyruk" class="mb-3">
                        <label class="form-label">Kuyruk Parçası</label>
                        <select class="form-select" id="kuyruk-parcasi" required>
                            <option value="">Seçiniz</option>
                        </select>
                        <div class="form-text">Stok durumu: <span class="stok-durumu">-</span></div>
                    </div>
                    <div id="parca-aviyonik" class="mb-3">
                        <label class="form-label">Aviyonik Parçası</label>
                        <select class="form-select" id="aviyonik-parcasi" required>
                            <option value="">Seçiniz</option>
                        </select>
                        <div class="form-text">Stok durumu: <span class="stok-durumu">-</span></div>
                    </div>
                </div>
            </form>
        `;
        
            $("#modalBody").html(formHtml);
        
        // Model seçildiğinde parçaları getir
            $("#ucak-model").change(function () {
            const modelId = $(this).val();
            if (modelId) {
                // Parça seçim alanını göster
                    $("#parca-secim-alani").show();
                
                // Her parça tipi için uygun parçaları getir
                const parcaTipleri = {
                        "kanat-parcasi": "KANAT",
                        "govde-parcasi": "GOVDE",
                        "kuyruk-parcasi": "KUYRUK",
                        "aviyonik-parcasi": "AVIYONIK",
                };
                
                Object.entries(parcaTipleri).forEach(([selectId, tip]) => {
                    const select = $(`#${selectId}`);
                        const container = select.closest(".mb-3");
                        const stokDurumu = container.find(".stok-durumu");
                    
                    // Loading göster
                        container.find(".parca-spinner").remove();
                        container.find(".alert").remove();
                        container.append(
                            '<div class="spinner-border text-primary mt-2 parca-spinner" role="status"><span class="visually-hidden">Yükleniyor...</span></div>'
                        );
                    
                    $.ajax({
                        url: `${API_URL}/parcalar/`,
                            type: "GET",
                        data: {
                            tip: tip,
                            ucak_modeli: modelId,
                                kullanildi: false,
                        },
                            beforeSend: function (xhr) {
                                xhr.setRequestHeader("Authorization", "Bearer " + getToken());
                        },
                            success: function (data) {
                            // Loading kaldır
                                container.find(".parca-spinner").remove();
                            
                            const parcalar = data.results || data || [];
                            console.log(`${tip} tipi için parçalar:`, parcalar);
                            
                            // Select'i temizle
                            select.empty().append('<option value="">Seçiniz</option>');
                            
                            // Stok durumunu güncelle
                                stokDurumu.text(
                                    parcalar.length > 0 ? `${parcalar.length} adet` : "Stokta yok"
                                );
                                stokDurumu
                                    .removeClass("text-success text-danger")
                                    .addClass(
                                        parcalar.length > 0 ? "text-success" : "text-danger"
                                    );
                            
                            if (parcalar.length === 0) {
                                    container.append(
                                        `<div class="alert alert-warning mt-2">Uygun ${tip} parçası bulunamadı!</div>`
                                    );
                                return;
                            }
                            
                            // Parçaları ekle
                                parcalar.forEach((parca) => {
                                    select.append(
                                        `<option value="${parca.id}">${parca.seri_no} - ${parca.uretim_takimi}</option>`
                                    );
                            });
                        },
                            error: function (xhr) {
                            // Loading kaldır
                                container.find(".parca-spinner").remove();
                                container.append(
                                    '<div class="alert alert-danger mt-2">Parçalar yüklenirken hata oluştu!</div>'
                                );
                                console.error("Parça yükleme hatası:", xhr.responseText);
                            },
                    });
                });
            } else {
                    $("#parca-secim-alani").hide();
            }
        });
        
            // Düzenleme durumunda, form verilerini al ve doldur
        if (isEdit) {
            $.ajax({
                url: `${API_URL}/ucaklar/${id}/`,
                    type: "GET",
                    beforeSend: function (xhr) {
                        xhr.setRequestHeader("Authorization", "Bearer " + getToken());
                },
                    success: function (data) {
                        $("#ucak-model").val(data.model);
                    // Model değişikliğini tetikle
                        $("#ucak-model").trigger("change");
                },
                    error: function (xhr) {
                        alert("Uçak bilgileri alınamadı.");
                    console.error(xhr.responseText);
                    },
            });
        }
        
            // Kaydet butonu işleyicisini ayarla
            $("#saveEntityBtn")
                .off("click")
                .on("click", function () {
            saveUcak();
        });
        
            // Modalı göster
            $("#entityModal").modal("show");
        })
        .fail(function () {
            alert("Veriler alınamadı.");
    });
}

// Uçak verilerini kaydet
function saveUcak() {
    const id = $("#ucak-id").val();
    const isEdit = id !== "";
    
    const data = {
        model: parseInt($("#ucak-model").val()),
        kanat_parcasi: parseInt($("#kanat-parcasi").val()),
        govde_parcasi: parseInt($("#govde-parcasi").val()),
        kuyruk_parcasi: parseInt($("#kuyruk-parcasi").val()),
        aviyonik_parcasi: parseInt($("#aviyonik-parcasi").val()),
    };
    
    console.log("Gönderilen veri:", data); // Debug için
    
    $.ajax({
        url: isEdit ? `${API_URL}/ucaklar/${id}/` : `${API_URL}/ucaklar/montaj/`,
        type: isEdit ? "PUT" : "POST",
        contentType: "application/json",
        data: JSON.stringify(data),
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            $("#entityModal").modal("hide");
            refreshCurrentTable();
        },
        error: function (xhr) {
            let errorMessage = "İşlem başarısız.";
            
            try {
                const response = JSON.parse(xhr.responseText);
                if (response.error) {
                    errorMessage = response.error;
                } else if (response.non_field_errors) {
                    errorMessage = response.non_field_errors.join("\n");
                } else if (response.detail) {
                    errorMessage = response.detail;
                } else {
                    const errors = [];
                    for (const field in response) {
                        if (Array.isArray(response[field])) {
                            errors.push(`${field}: ${response[field].join("\n")}`);
                        }
                    }
                    if (errors.length > 0) {
                        errorMessage = errors.join("\n");
                    }
                }
            } catch (e) {
                console.error("Hata mesajı işlenirken bir sorun oluştu:", e);
            }
            
            alert(errorMessage);
            console.error(xhr.responseText);
        },
    });
}

// Uçakı sil
function deleteUcak(id) {
    $.ajax({
        url: `${API_URL}/ucaklar/${id}/`,
        type: "DELETE",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function () {
            refreshCurrentTable();
        },
        error: function (xhr) {
            alert("Silme işlemi başarısız.");
            console.error(xhr.responseText);
        },
    });
}

// Uçak parçalarını görüntüle
function showUcakParts(id) {
    $.ajax({
        url: `${API_URL}/ucaklar/${id}/`,
        type: "GET",
        beforeSend: function (xhr) {
            xhr.setRequestHeader("Authorization", "Bearer " + getToken());
        },
        success: function (data) {
            const modalTitle = "Uçak Parçaları";
            $("#modalTitle").text(modalTitle);
            
            // Modal içeriğini oluştur
            const content = `
                <div class="row">
                    <div class="col-md-6">
                        <div class="card mb-3">
                            <div class="card-header">
                                <h5 class="mb-0">Uçak Bilgileri</h5>
                            </div>
                            <div class="card-body">
                                <p><strong>Seri No:</strong> ${data.seri_no}</p>
                                <p><strong>Model:</strong> ${data.model}</p>
                                <p><strong>Montaj Takımı:</strong> ${
                                    data.montaj_takimi
                                }</p>
                                <p><strong>Montaj Tarihi:</strong> ${new Date(
                                    data.montaj_tarihi
                                ).toLocaleString()}</p>
                                <p><strong>Durum:</strong> ${data.durum}</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h5 class="mb-0">Parça Özeti</h5>
                            </div>
                            <div class="card-body">
                                <div class="table-responsive">
                                    <table class="table table-bordered">
                                        <thead>
                                            <tr>
                                                <th>Parça Tipi</th>
                                                <th>Adet</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            ${Object.entries(
                                                data.kullanilan_parcalar.reduce(
                                                    (acc, parca) => {
                                                        acc[parca.tip] =
                                                            (acc[parca.tip] || 0) + 1;
                                                return acc;
                                                    },
                                                    {}
                                                )
                                            )
                                                .map(
                                                    ([tip, adet]) => `
                                                <tr>
                                                    <td>${tip}</td>
                                                    <td>${adet}</td>
                                                </tr>
                                            `
                                                )
                                                .join("")}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card mt-3">
                    <div class="card-header">
                        <h5 class="mb-0">Kullanılan Parçalar</h5>
                    </div>
                    <div class="card-body">
                        <div class="table-responsive">
                            <table class="table table-bordered">
                                <thead>
                                    <tr>
                                        <th>Parça Tipi</th>
                                        <th>Seri No</th>
                                        <th>Üretim Takımı</th>
                                        <th>Üretim Tarihi</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${data.kullanilan_parcalar
                                        .map(
                                            (parca) => `
                                        <tr>
                                            <td>${parca.tip}</td>
                                            <td>${parca.seri_no}</td>
                                            <td>${parca.uretim_takimi}</td>
                                            <td>${new Date(
                                                parca.uretim_tarihi
                                            ).toLocaleString()}</td>
                                        </tr>
                                    `
                                        )
                                        .join("")}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            `;
            
            $("#modalBody").html(content);
            
            // Kaydet butonunu gizle
            $("#saveEntityBtn").hide();
            
            // Büyük boyutta modalı göster
            $("#entityModal").modal({
                backdrop: "static",
                keyboard: false,
                size: "lg",
            });
            $("#entityModal").modal("show");
        },
        error: function (xhr) {
            alert("Uçak bilgileri alınamadı.");
            console.error(xhr.responseText);
        },
    });
}

// Uygulamayı başlat
$(document).ready(function () {
    checkAuth();

    // Menü tıklamalarını işle
    $(".nav-link").click(function (e) {
        e.preventDefault();
        const page = $(this).data("page");
        loadContent(page);
    });

    // Çıkış butonunu işle
    $("#logout-btn").click(function (e) {
        e.preventDefault();
        logout();
    });
}); 
