$(document).ready(function () {
  socket = io();

  $("#proxy_status").prop("selectedIndex", 0);
  $(".default_btn").css("cursor", "not-allowed");
  $(".default_btn").addClass("disabled");
  $(".default_btn").attr("disabled", true);
  $("#templates_tab").find("tbody").prepend($(".default_template").parents("tr"));

  if ($("#current_hw").val().includes("vaapi")) {
    $("#vaapi_device").parent().removeClass("d-none");
    let vaapi_device = $("#current_hw").val().split(";")[1];
    $("#vaapi_device").val(vaapi_device);
    $("#hardware_acceleration").children("option[value='vaapi']").prop("selected", true);
  } else {
    $("#hardware_acceleration")
      .children("option[value=" + $("#current_hw").val() + "]")
      .prop("selected", true);
  }

  if ($("#spotify_check").hasAttr("checked")) {
    $("#spotify_row").removeClass("d-none");
  }
  if ($("#genius_check").hasAttr("checked")) {
    $("#genius_row").removeClass("d-none");
  }

  function add_template(data) {
    function setAttributes(element, attributes) {
      Object.keys(attributes).forEach((attr) => {
        element.setAttribute(attr, attributes[attr]);
      });
    }

    let tr_visible = document.createElement("tr");
    let tr_hidden = document.createElement("tr");
    let td_hidden = document.createElement("td");
    let p_hidden = document.createElement("p");
    let td_name = document.createElement("td");
    let td_type = document.createElement("td");
    let td_extension = document.createElement("td");
    let td_output_folder = document.createElement("td");
    let td_output_name = document.createElement("td");
    let td_buttons = document.createElement("td");
    let default_btn = document.createElement("button");
    let edit_btn = document.createElement("button");
    let delete_btn = document.createElement("button");
    let expand_btn = document.createElement("button");
    let default_icon = document.createElement("i");
    let edit_icon = document.createElement("i");
    let delete_icon = document.createElement("i");
    let expand_icon = document.createElement("i");

    tr_visible.id = data["id"];
    tr_hidden.id = "hidden_" + data["id"];
    td_hidden.setAttribute("colspan", "7");

    tr_hidden.classList.add("d-none");
    td_hidden.classList.add("text-dark");
    td_name.classList.add("text-dark", "td_name");
    td_type.classList.add("text-dark", "td_td_type");
    td_extension.classList.add("text-dark", "td_extension");
    td_output_folder.classList.add("text-dark", "td_output_folder");
    td_output_name.classList.add("text-dark", "td_output_name");

    td_name.innerText = data["name"];
    td_type.innerText = data["type"];
    td_extension.innerText = data["ext"];
    td_output_folder.innerText = data["output_folder"];
    td_output_name.innerText = data["output_name"];

    default_btn.classList.add("btn", "btn-info", "set_default_template", "mr-1");
    edit_btn.classList.add("btn", "btn-success", "change_template_btn", "mr-1");
    delete_btn.classList.add("btn", "btn-danger", "del_template_btn", "mr-1");
    expand_btn.classList.add("btn", "btn-primary", "expand_template_btn", "mr-1");

    setAttributes(default_btn, {
      "data-toggle": "tooltip",
      "data-placement": "top",
      title: "Set as default template",
    });
    setAttributes(edit_btn, {
      "data-toggle": "tooltip",
      "data-placement": "top",
      title: "Edit template",
    });
    setAttributes(delete_btn, {
      "data-toggle": "tooltip",
      "data-placement": "top",
      title: "Delete template",
    });
    setAttributes(expand_btn, {
      "data-toggle": "tooltip",
      "data-placement": "top",
      title: "Show more info",
    });

    default_icon.classList.add("bi", "bi-check-lg");
    edit_icon.classList.add("bi", "bi-pencil-square");
    delete_icon.classList.add("bi", "bi-trash-fill");
    expand_icon.classList.add("bi", "bi-caret-down-fill");

    p_hidden.innerHTML = "Bitrate: " + data["bitrate"];

    if (data["type"] == "Video") {
      p_hidden.innerHTML +=
        "<br/>Width: " +
        data["resolution"].split(";")[0] +
        "<br/>Height: " +
        data["resolution"].split(";")[1];
    }
    if (data["proxy"]["status"] == true) {
      p_hidden.innerHTML +=
        "<br/>Proxy status: True <br/>Proxy type: " +
        data["proxy"]["type"] +
        "<br/>Proxy address: " +
        data["proxy"]["address"] +
        "<br/>Proxy port: " +
        data["proxy"]["port"];
      if (data["proxy"]["username"] != "") {
        p_hidden.innerHTML += "<br/>Proxy username: " + data["proxy"]["username"];
      } else {
        p_hidden.innerHTML += "<br/>Proxy username: None";
      }
      if (data["proxy"]["password"] != "") {
        p_hidden.innerHTML += "<br/>Proxy password: " + data["proxy"]["password"];
      } else {
        p_hidden.innerHTML += "<br/>Proxy password: None";
      }
    } else {
      p_hidden.innerHTML += "<br/>Proxy status: False";
    }

    td_hidden.appendChild(p_hidden);
    tr_hidden.appendChild(td_hidden);

    default_btn.appendChild(default_icon);
    edit_btn.appendChild(edit_icon);
    delete_btn.appendChild(delete_icon);
    expand_btn.appendChild(expand_icon);
    td_buttons.append(default_btn, edit_btn, delete_btn, expand_btn);
    tr_visible.append(td_name, td_type, td_extension, td_output_name, td_output_folder, td_buttons);
    $("#add_template_row").before(tr_visible, tr_hidden);
  }

  $(document).on("click", ".template_btn", function () {
    let goal = $(this).attr("goal");
    let id = $("#templates_modal").hasAttr("template_id")
      ? $("#templates_modal").attr("template_id")
      : "-1";
    let name = $("#template_name").val();
    let output_folder = $("#template_folder").val();
    let output_name = $("#template_output_name").val();
    let output_ext = $("#template_type").val();
    let bitrate = $("#template_bitrate").val() == "" ? "best" : $("#template_bitrate").val();
    let width = $("#template_resolution").val() == "best" ? "best" : $("#template_width").val();
    let height = $("#template_resolution").val() == "best" ? "best" : $("#template_height").val();
    let proxy_type = $("#proxy_status").val() == "false" ? "None" : $("#proxy_type").val();
    let proxy_json = JSON.stringify({
      status: $("#proxy_status").val(),
      type: proxy_type,
      address: $("#proxy_address").val(),
      username: $("#proxy_username").val(),
      password: $("#proxy_password").val(),
      port: $("#proxy_port").val(),
    });

    if (
      $("#template_type option:selected").parent().attr("label") == "Video" &&
      output_ext == "m4a"
    ) {
      output_ext = "m4a_video";
    } else if (output_ext == "m4a") {
      output_ext = "m4a_audio";
    }

    socket.emit(
      "update_template",
      name,
      output_folder,
      output_ext,
      output_name,
      id,
      goal,
      bitrate,
      width,
      height,
      proxy_json,
    );
  });

  $("#remove_template_modal, #templates_modal").on("hidden.bs.modal", function () {
    $(this).removeClass(["d-flex", "justify-content-center"]);
  });

  $(document).on("click", ".set_default_template", function () {
    let id = $(this).parents("tr").attr("id");
    socket.emit("set_default_template", id);
  });

  $(document).on("click", ".del_template_btn", function (e) {
    if ($(this).hasClass("default_btn")) {
      e.preventDefault();
    } else {
      $("#remove_template_modal_title").text(
        "Remove modal '" + $(this).parent().siblings(":first").text() + "'",
      );
      $("#remove_template_modal")
        .find(".btn-danger")
        .attr("id", $(this).parent().parent().attr("id"));
      $("#remove_template_modal").addClass(["d-flex", "justify-content-center"]);
      $("#remove_template_modal").modal("show");
    }
  });

  $("#del_template_btn_modal").on("click", function () {
    let id = $(this).attr("id");
    socket.emit("delete_template", id);
    $("#remove_template_modal").modal("hide");
  });
  $(document).on("click", ".change_template_btn", function (e) {
    if ($(this).hasClass("default_btn")) {
      e.preventDefault();
    } else {
      let id = $(this).parent().parent().attr("id");
      socket.emit("fetch_template", id);
      $("#templates_modal").addClass(["d-flex", "justify-content-center"]);
      $("#templates_modal").modal("show");
    }
  });
  $("#add_template_modal_btn").on("click", function () {
    $("#templates_modal")
      .children()
      .children()
      .children(".modal-header")
      .children("h5")
      .text("Add template");
    $("#templates_modal").removeAttr("template_id");
    $(
      "#template_name, #template_folder, #proxy_address, #proxy_username, #proxy_port, #proxy_password",
    ).val("");
    $("#template_bitrate").val("");
    $("#template_height, #template_width").val("best");
    $("#change_template_btn").attr("id", "add_template_btn");
    $("#add_template_btn").text("Add template");
    $("#add_template_btn").attr("goal", "add");
    $("#templates_modal").addClass(["d-flex", "justify-content-center"]);
    $("#templates_modal").modal("show");
    $("#advanced_toggle").text("Show advanced");
    $("#advanced_row, .videocol").addClass("d-none");
    $("#proxy_status").val("false").trigger("click");
    $("#proxy_row").children().not(":first").addClass("d-none");
    $("#template_type, #proxy_type").val([]);
  });

  $("#template_type").on("change", function () {
    if ($(":selected", $(this)).parent().attr("label") == "Video") {
      $(".videocol").removeClass("d-none");
    } else {
      $(".videocol").addClass("d-none");
    }
  });

  $("#advanced_toggle").on("click", function () {
    if ($("#advanced_row").hasClass("d-none")) {
      $(this).text("Hide advanced");
    } else {
      $(this).text("Show advanced");
    }
    $("#advanced_row").toggleClass("d-none");
  });

  $("#proxy_status").on("change", function () {
    $("#proxy_row").children("div.col:not(:first)").toggleClass("d-none");
  });

  $(document).on("click", ".expand_template_btn", function () {
    let id = $(this).parents("tr").attr("id");
    $(this)
      .parents("tr")
      .siblings("#hidden_" + id)
      .toggleClass("d-none");
  });

  $(".custom-control-label").on("click", function () {
    $(this).siblings(".metadata_input").trigger("click");
  });

  $(".metadata_input").on("change", function () {
    if ($(this).val() == "spotify") {
      if ($(this).is(":checked")) {
        $("#spotify_row").removeClass("d-none");
      } else {
        $("#spotify_row").addClass("d-none");
      }
    } else if ($(this).val() == "genius") {
      if ($(this).is(":checked")) {
        $("#genius_row").removeClass("d-none");
      } else {
        $("#genius_row").addClass("d-none");
      }
    }
  });

  $("#submit_download_settings_form").on("click", function () {
    let amount = $("#max_amount").val();
    let ffmpeg_path = $("#ffmpeg_path").val();
    let hardware_transcoding = $("#hardware_acceleration").val();
    let extra_data = {};
    if (hardware_transcoding == "vaapi") {
      hardware_transcoding += ";" + $("#vaapi_device").val();
    }
    let metadata_sources = $(".metadata_input:checked")
      .map(function () {
        return this.value;
      })
      .get();
    if (metadata_sources.indexOf("spotify") > -1) {
      if ($("#spotify_client_secret").val() == "" || $("#spotify_client_id").val() == "") {
        $("#download_settings_log").find("p").text("Enter the Spotify API credentials!");
        return false;
      } else {
        extra_data["spotify_api"] = {
          id: $("#spotify_client_id").val(),
          secret: $("#spotify_client_secret").val(),
        };
      }
    }
    if (metadata_sources.indexOf("genius") > -1) {
      if ($("#genius_access_token").val() == "") {
        $("#download_settings_log").find("p").text("Enter the Genius API credentials!");
        return false;
      } else {
        extra_data["genius_api"] = {
          token: $("#genius_access_token").val(),
        };
      }
    }
    socket.emit(
      "update_settings",
      ffmpeg_path,
      amount,
      hardware_transcoding,
      metadata_sources,
      extra_data,
    );
  });

  $("#hardware_acceleration").on("change", function () {
    if ($(this).val() == "vaapi") {
      $("#vaapi_device").parent().removeClass("d-none");
    } else {
      $("#vaapi_device").parent().addClass("d-none");
    }
  });

  $("#template_resolution").on("change", function () {
    if ($(this).val() != "best") {
      let width = $(this).val().split(";")[0];
      let height = $(this).val().split(";")[1];
      $("#template_width").val(width);
      $("#template_height").val(height);
      $(".videocol").not($(this).parent()).removeClass("d-none");
    } else {
      $(".videocol").not($(this).parent()).addClass("d-none");
    }
  });

  $(".toggle_secret").on("click", function () {
    if ($(this).parent().siblings("input").attr("type") == "password") {
      $(this).parents().siblings("input").attr("type", "text");
    } else {
      $(this).parent().siblings("input").attr("type", "password");
    }
  });

  socket.on("download_settings", function (msg) {
    $("#download_settings_log").find("p").html(msg);
  });

  socket.on("template_settings", function (msg) {
    $("#templates_log").text(msg.msg);
    if (msg.status == "delete") {
      $("tr#" + msg.template_id).remove();
      $("tr#hidden_" + msg.template_id).remove();
    } else if (msg.status == "set_default") {
      $(".default_template").prop("disabled", false);
      $(".default_template").attr({
        title: "Set as default template",
        "data-original-title": "Set as default template",
      });
      $(".default_template").removeClass(["default_template", "disabled"]);

      $("tr#" + msg.template_id)
        .find(".set_default_template")
        .addClass(["default_template", "disabled"]);
      $("tr#" + msg.template_id)
        .find(".set_default_template")
        .removeClass("set_default_template");
      $("tr#" + msg.template_id)
        .find(".default_template")
        .attr({
          title: "Template is already the default template",
          "data-original-title": "Template is already the default template",
        });
      $("tr#" + msg.template_id)
        .find(".default_template")
        .prop("disabled", true);

      $(".default_template").tooltip("hide");
      $("#templates_tab").find("tbody").prepend($(".default_template").parents("tr"));
    } else if (msg.status == "new_template") {
      $("#templates_modal").modal("hide");
      add_template(msg.data);
    } else if (msg.status == "changed_template") {
      $("#templates_modal").modal("hide");
    }
  });

  socket.on("change_template", function (msg) {
    $("p#template_modal_log").text(msg);
  });

  socket.on("template", function (response) {
    let data = JSON.parse(response);
    let name = data["name"];
    let output_name = data["output_name"];
    let bitrate = data["bitrate"];
    let width = data["resolution"].split(";")[0];
    let height = data["resolution"].split(";")[1];
    let resolution = data["resolution"];
    let output_folder = data["output_folder"];
    let ext = data["extension"];
    let type = data["type"];
    let id = data["id"];
    $("#templates_modal")
      .children()
      .children()
      .children(".modal-header")
      .children("h5")
      .text("Edit template '" + name + "'");
    $("#templates_modal").attr("template_id", id);
    $("#template_name").val(name);
    $("#template_folder").val(output_folder);
    $("#template_output_name").val(output_name);
    $("#template_bitrate").val(bitrate);
    if (type == "Audio") {
      $(".videocol").addClass("d-none");
    } else {
      $(".videocol").removeClass("d-none");
      $("#template_width").val(width);
      $("#template_height").val(height);
      $("#template_resolution")
        .children("option[value='" + resolution + "']")
        .prop("selected", true);
    }
    $("#template_type")
      .children("[label='" + type + "']")
      .children("[value='" + ext + "']")
      .attr("selected", true);
    $("#add_template_btn").attr("id", "change_template_btn");
    $("#change_template_btn").text("Change template");
    $("#change_template_btn").attr("goal", "edit");
    if (data["proxy_status"] == true) {
      let proxy_type = data["proxy_type"].toUpperCase();
      $("#advanced_toggle").text("Hide advanced");
      $("#advanced_row").removeClass("d-none");
      $("#proxy_status").val("true").trigger("click");
      $("#proxy_row").children().removeClass("d-none");
      $("#proxy_type option[value='" + proxy_type + "']").prop("selected", true);
      $("#proxy_address").val(data["proxy_address"]);
      $("#proxy_port").val(data["proxy_port"]);
      $("#proxy_username").val(data["proxy_username"]);
      $("#proxy_password").val(data["proxy_password"]);
    }
    $("#templates_modal").addClass(["d-flex", "justify-content-center"]);
    $("#templates_modal").modal("show");
  });
});
