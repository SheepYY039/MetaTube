var socket = io();
var progress_text;
$(document).ready(function () {
  ap = new APlayer({
    container: document.getElementById("audio_player"),
    autoplay: true,
    mini: false,
    loop: "none",
  });
  $("#metadata_view").find("input").attr("autocomplete", "off");
  $("#search_item, #filename").val("");
  $(".select_item, #select_all").prop("checked", false);
  function output_template() {
    if ($("#download_modal").css("display") != "none") {
      let val = $("#output_name").val();
      let url = $("#thumbnail_yt").attr("ytid");
      let info_dict = $("#thumbnail_yt").attr("info_dict");
      socket.emit("ytdl_template", { template: val, url: url, info_dict: info_dict });
    }
  }
  function spinner(msg, location) {
    let spinner =
      '<div class="spinner-border text-success" role="status"><span class="sr-only">' +
      msg +
      "</span></div>";
    $(location).remove("div.spinner-border");
    $(location).prepend(spinner);
  }
  // If the user presses Enter or submits the form in some other way, it'll trigger the 'find' button
  function insertYTcol(response, form) {
    let download_form = document.createElement("div");
    download_form.innerHTML = form;

    let data = response;
    let artist = "artist" in data ? data.artist : "Unknown";
    let track = "track" in data && data["track"] != null ? data.track : "Unknown";
    let album = "album" in data ? data.album : "Unknown";
    let channel = "channel" in data ? data.channel : data.uploader;
    let thumbnail = "";

    $.each(data.thumbnails, function (key_thumbnail, value_thumbnail) {
      if (value_thumbnail.preference == -23) {
        thumbnail = value_thumbnail.url;
      }
    });

    let minutes = Math.floor(data.duration / 60);
    let seconds = data.duration % 60;
    if (seconds < 10) {
      seconds = "0" + (data.duration % 60);
    }

    let length = minutes + ":" + seconds;
    let img = document.createElement("img");
    let paragraph = document.createElement("p");
    let ytcol = document.createElement("div");
    let media = document.createElement("div");
    let body = document.createElement("div");
    let media_header = document.createElement("h5");

    img.classList.add("img-fluid");
    img.id = "thumbnail_yt";
    img.setAttribute("ytid", data.id);
    img.src = thumbnail;
    img.title = "Click to watch video";
    img.alt = "Thumbnail for video" + data.title;
    img.setAttribute("onClick", "window.open('https://youtu.be/" + data.id + "', '_blank')");
    img.setAttribute("style", "cursor: pointer");
    img.setAttribute("url", data.webpage_url);
    img.setAttribute("info_dict", JSON.stringify(data));

    if ($(window).width() >= 650) {
      media.classList.add("media");
    }
    body.classList.add("media-body");
    media_header.classList.add("mt-0");
    media_header.innerText = data.title;

    paragraph.innerHTML =
      'Channel: <span id="channel_span">' +
      channel +
      "</span><br/>Length: " +
      length +
      '</br/>Track name: <span id="track_span">' +
      track +
      '</span><br/>Artist: <span id="artist_span">' +
      artist +
      '</span><br/><span id="album_span">Album: ' +
      album +
      "</span>";
    ytcol.id = "ytcol";
    ytcol.setAttribute("style", "width: 100%;");

    body.append(media_header, paragraph);
    media.append(img, body);

    $("#default_view").empty().append(ytcol);
    $("#ytcol").append(media, download_form.firstChild);

    $("#search_video_modal_footer").removeClass("d-none");
    $("#reset_view_btn, #edit_metadata, #download_btn").addClass("d-none");
    $("#next_btn, #ytcol, hr").removeClass("d-none");
  }

  function create_audio_col(data) {
    let ul = document.createElement("ul");
    let img = document.createElement("img");
    let desc = document.createElement("div");
    let header = document.createElement("h5");
    let header_anchor = document.createElement("a");
    let paragraph = document.createElement("p");
    let input_group = document.createElement("div");
    let checkbox = document.createElement("input");
    let list = document.createElement("li");

    ul.classList.add("list-unstyled");
    img.classList.add("align-self-center", "mr-3", "img-fluid");
    desc.classList.add("media-body");
    header.classList.add("mt-0", "mb-1");

    header_anchor.href = data["url"];
    header_anchor.target = "_blank";
    header_anchor.innerText = data["title"];
    header_anchor.className = "dark_anchor";

    img.src = data["cover"];
    img.target = "_blank";
    img.style = "width: 300px; height: 300px;";

    paragraph.innerHTML =
      data["artists"] +
      "<br />Type: " +
      data["type"] +
      "<br/>Date: " +
      data["date"] +
      "<br/>Language: " +
      data["language"] +
      "<br />Source: <span class='metadata_source'>" +
      data["source"] +
      "</span>";

    input_group.classList.add("input-group-text");

    checkbox.classList.add("audio_col-checkbox");
    checkbox.type = "radio";
    checkbox.ariaLabel = "Radio button for selecting an item";

    list.setAttribute("style", "cursor: pointer");
    list.id = data["id"];
    if ($(window).width() >= 600) {
      list.classList.add("media");
      list.append(img, desc, input_group);
    } else {
      list.append(img, input_group, desc);
      input_group.classList.add("float-right");
      img.classList.add("mw-100", "w-75");
    }
    list.classList.add("mbp-item");

    header.append(header_anchor);
    desc.append(header, paragraph);

    input_group.appendChild(checkbox);
    ul.appendChild(list);

    $("#edit_metadata, #download_btn, #reset_view_btn, #genius_btn").removeClass("d-none");
    $(".spinner-border").remove();
    $("#next_btn").addClass("d-none");
    if (data["source"] == "Genius") {
      if (!$("#genius_col").length) {
        let genius_col = document.createElement("div");
        genius_col.setAttribute("style", "width: 100%;");
        genius_col.id = "genius_col";
        $("#default_view").append(genius_col);
      }
      $("#genius_col").append(ul);
    } else {
      if (!$("#audio_col").length) {
        let audio_col = document.createElement("div");
        audio_col.setAttribute("style", "width: 100%;");
        audio_col.id = "audio_col";
        $("#default_view").append(audio_col);
      }
      $("#audio_col").append(ul);
    }
  }

  function insert_musicbrainz_data(mbp_data) {
    let release_id = mbp_data.id;
    let title = mbp_data.title;
    let artists = mbp_data["artist-credit"].length > 1 ? "Artists: <br />" : "Artist: ";
    let date = mbp_data.date;
    let language = "";
    if ("text-representation" in mbp_data) {
      if ("language" in mbp_data["text-representation"]) {
        language = mbp_data["text-representation"]["language"];
      } else {
        language = "Unknown";
      }
    } else {
      language = "Unknown";
    }
    $.each(mbp_data["artist-credit"], function (key_artist, value_artist) {
      if (typeof value_artist == "object") {
        let a =
          '<a href="https://musicbrainz.org/artist/' +
          value_artist.artist.id +
          '" class="dark_anchor" target="_blank">' +
          value_artist.name +
          "</a> <br/>";
        artists += a;
      }
    });
    let release_type = mbp_data["release-group"].type;
    let mbp_url = "https://musicbrainz.org/release/" + release_id;
    let mbp_image = "";
    if ("cover" in mbp_data && mbp_data.cover != "None" && mbp_data.cover != "error") {
      mbp_image = mbp_data.cover.images[0].thumbnails.small.replace(/^http:/, "https:");
    } else {
      mbp_image = "/static/images/empty_cover.png";
    }
    let data = {
      url: mbp_url,
      title: title,
      artists: artists.slice(0, artists.length - 5),
      type: release_type,
      date: date,
      language: language,
      source: "Musicbrainz",
      cover: mbp_image,
      id: release_id,
    };
    create_audio_col(data);
  }

  function insert_spotify_data(spotify_data) {
    let title = spotify_data["name"];
    let artists = spotify_data["artists"].length > 1 ? "Artists: " : "Artist: ";
    let date = spotify_data["album"]["release_date"];
    let language = "Unknown";
    let type = spotify_data["album"]["type"];
    let id = spotify_data["id"];
    let url = spotify_data["external_urls"]["spotify"];
    let cover = "";
    for (let i = 0; i < Object.keys(spotify_data["artists"]).length; i++) {
      if (typeof spotify_data["artists"][i] == "object") {
        let link =
          "<a href='https://open.spotify.com/artist/" +
          spotify_data["artists"][i]["id"] +
          "' class='dark_anchor' target='_blank'>" +
          spotify_data["artists"][i]["name"] +
          "</a> <br />";
        artists += link;
      }
    }
    for (let i = 0; i < Object.keys(spotify_data["album"]["images"]).length; i++) {
      if (spotify_data["album"]["images"][i].height == "300") {
        cover = spotify_data["album"]["images"][i]["url"];
      }
    }
    let data = {
      url: url,
      title: title,
      artists: artists.slice(0, artists.length - 7),
      type: type,
      date: date,
      language: language,
      source: "Spotify",
      cover: cover,
      id: id,
    };
    create_audio_col(data);
  }

  function insert_deezer_data(deezer_data) {
    let title = deezer_data["title"];
    let artists =
      "Artist: <a href='" +
      deezer_data["link"] +
      "' class='dark_anchor' target='_blank'>" +
      deezer_data["artist"]["name"] +
      "</a>";
    let type = deezer_data["album"]["type"];
    let url = deezer_data["link"];
    let date = "Unknown";
    let language = "Unknown";
    let cover = deezer_data["album"]["cover_medium"];
    let id = deezer_data["id"];
    let data = {
      url: url,
      title: title,
      artists: artists,
      type: type,
      date: date,
      language: language,
      source: "Deezer",
      cover: cover,
      id: id,
    };
    create_audio_col(data);
  }

  function insert_genius_data(genius_data) {
    let title = genius_data["title"];
    let artists = genius_data["featured_artists"].length > 0 ? "Artists: " : "Artist: ";
    let type = "Song";
    let url = genius_data["url"];
    let date =
      genius_data["release_date_components"] != null
        ? genius_data["release_date_components"]["day"] +
          genius_data["release_date_components"]["month"] +
          genius_data["release_date_components"]["year"]
        : "Unknown";
    let language = "Unknown";
    let cover = genius_data["header_image_thumbnail_url"];
    let id = genius_data["id"];
    artists +=
      "<a href='" +
      genius_data["primary_artist"]["url"] +
      "' class='dark_anchor' target='_blank'>" +
      genius_data["primary_artist"]["name"] +
      "</a> <br />";
    for (let i = 0; i < genius_data["featured_artists"].length; i++) {
      artists +=
        "<a href='" +
        genius_data["featured_artists"][i]["url"] +
        "' class='dark_anchor' target='_blank'>" +
        genius_data["featured_artists"][i]["name"] +
        "</a> <br />";
    }
    let data = {
      url: url,
      title: title,
      artists: artists.slice(0, artists.length - 7),
      type: type,
      date: date,
      language: language,
      source: "Genius",
      cover: cover,
      id: id,
    };
    create_audio_col(data);
  }

  function add_person() {
    let add_button = $(".add_person");
    let id =
      add_button.parents(".person_row").siblings(".person_row").length > 0
        ? parseInt(
            add_button
              .parents(".person_row")
              .siblings(".person_row:last")
              .attr("id")
              .slice(add_button.parents(".person_row").attr("id").length - 1),
          ) + 1
        : parseInt(
            add_button
              .parents(".person_row")
              .attr("id")
              .slice(add_button.parents(".person_row").attr("id").length - 1),
          ) + 1;
    let row = document.createElement("div");
    let col_name = document.createElement("div");
    let col_type = document.createElement("div");
    let input_group = document.createElement("div");
    let input_group_append = document.createElement("div");
    let input_name = document.createElement("input");
    let input_type = document.createElement("input");
    let button = document.createElement("button");
    let icon = document.createElement("i");

    row.classList.add("form-row", "person_row");
    row.id = "person_row" + id;

    col_name.classList.add("col");
    col_type.classList.add("col");

    input_name.classList.add("form-control", "artist-relations");
    input_name.id = "artist_relations_name" + id;

    input_type.classList.add("form-control", "artist-relations");
    input_type.id = "artist_relations_type" + id;

    input_group.classList.add("input-group");
    input_group_append.classList.add("input-group-append");

    button.classList.add("btn", "btn-danger", "bg-danger", "remove_person");
    button.type = "button";

    icon.classList.add("bi", "bi-dash");
    icon.setAttribute("style", "color: white");

    button.appendChild(icon);
    input_group_append.appendChild(button);
    input_group.appendChild(input_type);
    input_group.appendChild(input_group_append);
    col_type.appendChild(input_group);
    col_name.appendChild(input_name);
    row.appendChild(col_name);
    row.appendChild(col_type);
    $(".person_row:last").after(row);

    return $(".person_row:last");
  }

  function add_segment(id) {
    let row = document.createElement("div");
    let start_col = document.createElement("div");
    let end_col = document.createElement("div");
    let start_input = document.createElement("input");
    let end_input = document.createElement("input");
    let input_group = document.createElement("div");
    let input_group_append = document.createElement("div");
    let remove_btn = document.createElement("button");
    let remove_icon = document.createElement("i");

    row.classList.add("form-row", "timestamp_row");
    row.id = "row_" + id;

    start_col.classList.add("col");
    end_col.classList.add("col");

    input_group.classList.add("input-group");
    input_group_append.classList.add("input-group-append");

    remove_btn.classList.add(
      "btn",
      "btn-danger",
      "bg-danger",
      "input-group-text",
      "remove_segment",
    );
    remove_icon.classList.add("bi", "bi-dash");
    remove_icon.setAttribute("style", "color: white");

    start_input.classList.add("form-control", "timestamp_input");
    start_input.id = "segment_start_" + id;
    start_input.type = "text";

    end_input.classList.add("form-control", "timestamp_input");
    end_input.id = "segment_end_" + id;
    end_input.type = "text";

    remove_btn.appendChild(remove_icon);
    input_group_append.appendChild(remove_btn);
    input_group.appendChild(end_input);
    input_group.appendChild(input_group_append);

    start_col.appendChild(start_input);
    end_col.appendChild(input_group);
    row.appendChild(start_col);
    row.appendChild(end_col);

    $(".timestamp_row:last").after(row);
  }

  function add_item(data) {
    function addLeadingZeros(n) {
      if (n <= 9) {
        return "0" + n;
      }
      return n;
    }
    let item_data = data.data;
    let date_obj = new Date(item_data["date"]);
    let date =
      addLeadingZeros(date_obj.getDate()) +
      "-" +
      addLeadingZeros(date_obj.getMonth() + 1) +
      "-" +
      date_obj.getFullYear();
    let tr = document.createElement("tr");
    let td_name = document.createElement("td");
    let td_artist = document.createElement("td");
    let td_album = document.createElement("td");
    let td_date = document.createElement("td");
    let td_ext = document.createElement("td");
    let td_actions = document.createElement("td");
    let input_group = document.createElement("div");
    let form_check = document.createElement("div");
    let checkbox = document.createElement("input");
    let dropdown = document.createElement("div");
    let dropdown_btn = document.createElement("button");
    let dropdown_menu = document.createElement("div");
    let cover = document.createElement("img");
    let cover_col = document.createElement("div");
    let name_col = document.createElement("div");
    let name_span = document.createElement("span");
    let name_row = document.createElement("div");

    td_artist.innerText = item_data["artist"];
    td_album.innerText = item_data["album"];
    td_date.innerText = date;
    td_ext.innerText = item_data["filepath"]
      .split(".")
      [item_data["filepath"].split(".").length - 1].toUpperCase();
    dropdown_btn.innerText = "Select action";
    name_span.innerText = item_data["name"];

    name_row.classList.add("row", "d-flex", "justify-content-center");
    name_col.classList.add("align-self-center");
    name_span.classList.add("align-middle");
    if ($(window).width() > 991) {
      cover_col.classList.add("col");
      name_col.classList.add("col");
    }
    name_col.style.margin = "0 10px 0 10px";

    td_name.setAttribute("style", "vertical-align: middle;");
    td_artist.setAttribute("style", "vertical-align: middle;");
    td_album.setAttribute("style", "vertical-align: middle;");
    td_date.setAttribute("style", "vertical-align: middle;");
    td_ext.setAttribute("style", "vertical-align: middle;");
    td_actions.setAttribute("style", "vertical-align: middle;");

    td_name.classList.add("td_name", "text-dark");
    td_artist.classList.add("td_artist", "text-dark");
    td_album.classList.add("td_album", "text-dark");
    td_date.classList.add("td_date", "text-dark");
    td_ext.classList.add("td_ext", "text-dark");

    input_group.classList.add("d-flex", "justify-content-end");
    form_check.classList.add("form-check", "ml-2");
    checkbox.classList.add("form-check-input", "select_item");
    checkbox.type = "checkbox";

    dropdown.classList.add("dropdown");
    dropdown_btn.classList.add("btn", "btn-primary", "dropdown-toggle");
    dropdown_btn.setAttribute("data-toggle", "dropdown");
    dropdown_menu.classList.add("dropdown-menu");

    tr.id = item_data["id"];

    cover.classList.add("img-fluid", "cover-img");
    cover.setAttribute("style", "width: 100px; height: 100px;");
    cover.src = item_data["image"];

    form_check.appendChild(checkbox);

    dropdown.append(dropdown_btn, dropdown_menu);
    input_group.append(dropdown, form_check);
    td_actions.appendChild(input_group);

    name_col.appendChild(name_span);
    cover_col.appendChild(cover);
    name_row.append(cover_col, name_col);
    td_name.appendChild(name_row);

    tr.append(td_name, td_artist, td_album, td_date, td_ext, td_actions);
    $("#empty_row").remove();
    $("#record_stable").children("tbody").append(tr);
    create_dropdown_menu(item_data["id"], item_data["ytid"]);
  }

  function downloadURI(uri, name) {
    var link = document.createElement("a");
    link.download = name;
    link.href = uri;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    delete link;
  }

  function search_result(data) {
    let ul = document.createElement("ul");
    let li = document.createElement("li");
    let img = document.createElement("img");
    let body = document.createElement("div");
    let header = document.createElement("a");
    let channel = document.createElement("a");
    let desc = document.createElement("p");

    ul.classList.add("list-unstyled", "youtube_result");
    img.classList.add("img-fluid");
    body.classList.add("media-body");
    header.classList.add("youtube_link");

    header.href = data.link;
    header.innerText = data.title;
    header.target = "_blank";
    header.classList.add("youtube_link", "dark_anchor");

    img.src = data.thumbnails[0].url;
    channel.href = data.channel.link;
    channel.innerText = data.channel.name;
    channel.target = "_blank";
    channel.className = "dark_anchor";

    ul.setAttribute("style", "cursor: pointer");

    desc.innerHTML = "Channel: " + channel.outerHTML + "<br />Description: ";
    try {
      for (let i = 0; i < data.descriptionSnippet.length; i++) {
        desc.innerHTML += data.descriptionSnippet[i].text;
      }
    } catch {
      desc.innerHTML += "No description available";
    }
    if ($(window).width() >= 700) {
      li.classList.add("media");
    }
    body.append(header, desc);
    li.append(img, body);
    ul.append(li);
    $("#default_view").find(".spinner-border").remove();
    $("#default_view").removeClass(["d-flex", "justify-content-center"]);
    $("#default_view").append(ul);
  }

  function insert_file_browser_item(item) {
    // Thanks to https://stackoverflow.com/a/18650828
    function formatBytes(bytes, decimals = 2) {
      if (bytes === 0) return "0 Bytes";

      const k = 1024;
      const dm = decimals < 0 ? 0 : decimals;
      const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

      const i = Math.floor(Math.log(bytes) / Math.log(k));

      return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
    }

    let tr = document.createElement("tr");
    let td_filename = document.createElement("td");
    let td_last_modified = document.createElement("td");
    let td_filesize = document.createElement("td");
    let span = document.createElement("span");
    let item_icon = document.createElement("i");
    let remove_icon = document.createElement("i");
    let remove_anchor = document.createElement("a");
    let nbsp = document.createTextNode("\u00A0");

    let extensions = item["filename"]
      .split(".")
      [item["filename"].split(".").length - 1].toUpperCase();
    let video_extensions = ["MP4", "M4A", "FLV", "WEBM", "OGG", "MKV", "AVI"];
    let icon_class = "bi";
    let timestamp = new Date(item["last_modified"] * 1000);

    span.innerText = item["filename"];
    td_last_modified.innerText = timestamp.toLocaleString();
    td_filesize.innerText = formatBytes(item["filesize"]);

    td_filename.classList.add("text-dark");
    td_last_modified.classList.add("text-dark");
    td_filesize.classList.add("text-dark");

    td_filename.style.width = "40%";
    td_last_modified.style.width = "30%";
    td_filesize.style.width = "30%";

    if (item["path_type"] == "directory") {
      let confirm = document.createElement("button");
      let cancel = document.createElement("button");
      let popover_group = document.createElement("div");

      confirm.classList.add("btn", "btn-danger", "confirm_removal");
      cancel.classList.add("btn", "btn-success", "cancel_removal");
      popover_group.classList.add("btn-group");

      confirm.type = "button";
      cancel.type = "button";
      confirm.innerText = "Confirm";
      cancel.innerText = "Cancel";

      popover_group.setAttribute("role", "group");
      popover_group.setAttribute("aria-label", "Button group");
      popover_group.setAttribute("filepath", item["filepath"]);
      popover_group.append(cancel, confirm);

      remove_anchor.href = "javascript:void(0)";
      remove_anchor.classList.add("text-dark", "remove_folder");
      remove_anchor.style.textDecoration = "None";
      remove_anchor.style.float = "right";

      let popover_options = {
        html: true,
        placement: "auto",
        title: "Delete directory?",
        trigger: "focus",
        content: popover_group,
      };
      $(remove_anchor).popover(popover_options);

      remove_icon.classList.add("bi", "bi-folder-minus");
      remove_anchor.append(remove_icon);
      td_last_modified.append(remove_anchor);
      icon_class += " bi-folder-fill";
    } else {
      if (video_extensions.indexOf(extensions) > -1) {
        icon_class += " bi-camera-video-fill";
      } else {
        icon_class += " bi-file-music-fill";
      }
    }

    item_icon.className = icon_class;

    if ("create_new_folder" in item) {
      let input = document.createElement("input");
      let button = document.createElement("button");
      let check = document.createElement("i");
      let form = document.createElement("span");

      input.classList.add("form-control", "directory_input", "w-75");
      input.setAttribute("placeholder", "Enter directory name");
      form.classList.add("form-inline");
      form.append(item_icon, nbsp, input);
      td_filename.append(form);

      button.classList.add("btn", "btn-success", "create_directory_btn", "ml-2");
      button.type = "button";
      button.setAttribute("data-toggle", "tooltip");
      button.setAttribute("data-placement", "right");
      button.title = "Create directory";
      check.classList.add("bi", "bi-check");
      button.append(check);

      td_last_modified.append(button);
    } else {
      td_filename.append(item_icon, nbsp, span);
    }

    tr.classList.add("file_browser_row", item["path_type"]);
    tr.style.cursor = "pointer";
    tr.setAttribute("filepath", item["filepath"]);
    tr.append(td_filename, td_filesize, td_last_modified);
    if ($("#file_browser_up").parent().children().length == 1 || !("create_new_folder" in item)) {
      $("#file_browser_up").parent().children(":last-child").after(tr);
    } else {
      if ($(".file").length > 0) {
        $(".file:first").before(tr);
      } else {
        $(".directory:last").after(tr);
      }
    }
  }

  function create_dropdown_menu(row_id, youtube_id = null) {
    let edit_file_btn = document.createElement("a");
    let edit_metadata_btn = document.createElement("a");
    let download_item_btn = document.createElement("a");
    let play_item_btn = document.createElement("a");
    let move_item_btn = document.createElement("a");
    let youtube_btn = document.createElement("a");
    let delete_btn = document.createElement("a");

    let elements = [
      edit_file_btn,
      edit_metadata_btn,
      download_item_btn,
      play_item_btn,
      move_item_btn,
      youtube_btn,
      delete_btn,
    ];
    let metadata_extensions = ["MP3", "OPUS", "FLAC", "OGG", "MP4", "M4A"];
    let extension = $("tr#" + row_id)
      .children(".td_ext")
      .text();

    elements.forEach((button) => {
      button.href = "javascript:void(0)";
      button.className = "dropdown-item";
    });

    edit_file_btn.innerText = "Change file_data";
    edit_metadata_btn.innerText =
      metadata_extensions.indexOf(extension) > -1 ? "Change metadata" : "Metadata is not supported";
    download_item_btn.innerText = "Download item";
    play_item_btn.innerText = "Play item";
    move_item_btn.innerText = "Move item's file location";
    youtube_btn.innerText = "View YouTube video";
    delete_btn.innerText = "Delete item";

    edit_file_btn.classList.add("d-none", "d-md-block", "edit_file_btn");
    edit_metadata_btn.classList.add("d-none", "d-md-block", "edit_metadata_btn");
    move_item_btn.classList.add("d-none", "d-md-block", "move_item_btn");
    download_item_btn.classList.add("download_item_btn");
    play_item_btn.classList.add("play_item_btn");
    delete_btn.classList.add("delete_item_btn");

    if (youtube_id != null) {
      youtube_btn.href = youtube_id;
      $("tr#" + row_id)
        .find(".dropdown-menu")
        .append(youtube_btn, delete_btn);
    }
    $("tr#" + row_id)
      .find(".dropdown-menu")
      .children(":first-child")
      .before(edit_file_btn, edit_metadata_btn, download_item_btn, play_item_btn, move_item_btn);
    $("tr#" + row_id)
      .find(".find_item_btn")
      .remove();
  }

  function getMetadata() {
    let release_id = $(".audio_col-checkbox:checked").parent().parent().attr("id");
    let people = {};
    let metadata_source =
      $("#audio_col").length > 0
        ? $(".audio_col-checkbox:checked").parents("li").find("span.metadata_source").text()
        : "Unavailable";
    let cover =
      $("#audio_col").length > 0
        ? $(".audio_col-checkbox:checked").parents("li").children("img").attr("src")
        : "Unavailable";

    if (metadata_source == "Unavailable") {
      // The priority order is: Spotify -> Deezer -> Musibrainz
      var trackid =
        $("#spotify_trackid").length > 0
          ? $("#spotify_trackid").val()
          : $("#deezer_releaseid").val().length > 0
            ? $("#deezer_trackid").val()
            : $("#mbp_trackid").val();
      var albumid =
        $("#spotify_albumid").length > 0
          ? $("#spotify_albumid").val()
          : $("#deezer_albumid").val().length > 0
            ? $("#deezer_albumid").val()
            : $("#mbp_albumid").val();
    } else if (metadata_source == "Spotify") {
      var trackid = $("#spotify_trackid").val();
      var albumid = $("#spotify_albumid").val();
    } else if (metadata_source == "Musicbrainz") {
      var trackid = $("#mbp_releaseid").val();
      var albumid = $("#mbp_albumid").val();
    } else if (metadata_source == "Deezer") {
      var trackid = $("#deezer_trackid").val();
      var albumid = $("#deezer_albumid").val();
    } else if (metadata_source == "Genius") {
      var trackid = $("#genius_songid").val();
    }

    $.each($(".artist_relations"), function () {
      if (
        $(this).val().trim().length < 1 ||
        $(this).parent().siblings().find(".artist_relations").val().trim().length < 1
      ) {
        return;
      } else {
        // Get ID by removing all letters from the ID, so the number remains
        let id = $(this)
          .parents(".person_row")
          .attr("id")
          .replace(/[a-zA-Z]/g, "");
        if (this.id.replace(/[0-9]/g, "") == "artist_relations_name") {
          people[id].name = $(this).val();
        } else {
          people[id].type = $(this).val();
        }
      }
    });

    let artists = $("#md_artists").val().split(";");
    let album_artists = $("#md_album_artists").val().split(";");
    return {
      trackid: trackid,
      albumid: albumid,
      title: $("#md_title").val(),
      artists: JSON.stringify(artists),
      album: $("#md_album").val(),
      album_artists: JSON.stringify(album_artists),
      album_tracknr: $("#md_album_tracknr").val(),
      album_releasedate: $("#md_album_releasedate").val(),
      cover: $("#md_cover").val(),
      people: JSON.stringify(people),
      cover: cover,
      release_id: release_id,
      metadata_source: metadata_source,
    };
  }

  function getPhases() {
    return $("#segments_check").is(":checked") ? 4 : 5;
  }

  function getProgress() {
    return $("#edit_item_modal").css("display").toLowerCase() != "none"
      ? $("#progress_edit")
      : $("#progress");
  }

  function setProgress(percentage) {
    getProgress()
      .attr({
        "aria-valuenow": percentage + "%",
        style: "width: " + parseInt(percentage) + "%",
      })
      .text(percentage + "%");
  }

  $(window)
    .resize(function () {
      if ($(window).width() < 700) {
        $(".youtube_result").children("li").removeClass("media");
      } else {
        $(".youtube_result").children("li").addClass("media");
      }
      if ($(window).width() < 650) {
        $("#ytcol").children("div").removeClass("media");
      } else {
        $("#ytcol").children("div").addClass("media");
      }
      if ($(window).width() < 600) {
        $(".mbp-item").removeClass("media");
        let input_group = $(".mbp-item").children(".input-group-text");
        for (let i = 0; i < input_group.length; i++) {
          let li = $(".mbp-item")[i];
          $(li).children(".media-body").before(input_group[i]);
        }
        input_group.addClass("float-right");
        $(".mbp-item").removeClass("media");
        $(".mbp-item").children("img").addClass(["mw-100", "w-75"]);
      } else {
        let input_group = $(".mbp-item").children(".input-group-text");
        for (let i = 0; i < input_group.length; i++) {
          let li = $(".mbp-item")[i];
          $(li).children(".media-body").after(input_group[i]);
        }
        input_group.removeClass("float-right");
        $(".mbp-item").addClass("media");
        $(".mbp-item").children("img").removeClass(["mw-100", "w-75"]);
      }
      if ($(window).width() < 992) {
        $(".td_name").find(".col").removeClass("col");
      } else {
        $(".td_name").children(".row").children("div").addClass("col");
      }
    })
    .resize();

  $(document).on("mouseenter", ".mbp-item, .youtube_result", function () {
    $(this).css("filter", "brightness(50%)");
    $(this).css("background-colour", "#009999");
  });
  $(document).on("mouseleave", ".mbp-item, .youtube_result", function () {
    $(this).css("filter", "");
    $(this).css("background-colour", "white");
  });
  $(document).on("click", ".mbp-item", function () {
    let checkbox = $(this).children(".input-group-text").children("input");
    checkbox.prop("checked", true);
    $(".mbp-item input[type='radio']").not(checkbox).prop("checked", false);
  });
  $(document).on("change", "#template", function () {
    let id = $(this).val();
    socket.emit("fetch_template", id);
  });

  $(document).on("keydown", "#output_name", output_template);

  $(document).on("click", ".remove_segment", function () {
    $(this).parents(".form-row").remove();
  });
  $(document).on("click", "#add_segment", function () {
    let id =
      $(this).parents(".form-row").siblings(".timestamp_row").length > 0
        ? parseInt(
            $(this).parents(".form-row").siblings(".timestamp_row:last").attr("id").slice(4),
          ) + 1
        : parseInt($(this).parents(".form-row").attr("id").slice(4)) + 1;
    add_segment(id);
  });

  $(document).on("click", "#segments_check", function () {
    $(".timestamp_row").toggleClass("d-none");
    $(".timestamp_caption").parents(".form-row").toggleClass("d-none");
  });

  $(document).on("click", "label[for='#segments_check']", function () {
    $(this).siblings("input").click();
  });

  $(document).on("change", "#extension", function () {
    if ($("#extension option:selected").parent().attr("label") == "Video") {
      $("#type").val("Video");
      $("#video_row").removeClass("d-none");
    } else if ($("#extension option:selected").parent().attr("label") == "Audio") {
      $("#video_row").addClass("d-none");
      $("#type").val("Audio");
    }
    if ($("#extension option:selected").hasAttr("nosupport")) {
      $("#next_btn").addClass("d-none");
      $("#download_btn").removeClass("d-none");
    } else {
      $("#next_btn").removeClass("d-none");
      $("#download_btn").addClass("d-none");
    }
    output_template();
  });

  $(document).on("change", "#resolution", function () {
    if ($(this).val() != "best") {
      $("#width").val($(this).val().split(";")[0]);
      $("#height").val($(this).val().split(";")[1]);
      $(this).parent().siblings().removeClass("d-none");
    } else {
      $("#width").val("best");
      $("#height").val("best");
      $(this).parent().siblings().addClass("d-none");
    }
  });

  $(document).on("click", "#metadata_view_btn", function () {
    $("#genius_col, #audio_col, #metadata_view_btn, #genius_btn").toggleClass("d-none");
  });

  $(document).on("click", "#edit_metadata", function () {
    $(
      "#audio_col, #genius_col, #query_form, #genius_btn, #download_btn, #reset_view_btn, #metadata_view_btn",
    ).addClass("d-none");
    $("#metadata_view").removeClass("d-none");
    $(this).attr("id", "save_metadata");
    $(this).text("Save metadata");
  });

  $(document).on("click", "#save_metadata", function () {
    $(
      "#audio_col, #genius_col, #query_form, #genius_btn, #download_btn, #reset_view_btn, #metadata_view_btn",
    ).removeClass("d-none");
    $("#metadata_view").addClass("d-none");
    if ($("#audio_col").length < 1) {
      $("#search_metadata_view").removeClass("d-none");
    }
    $(this).attr("id", "edit_metadata");
    $(this).text("Edit metadata");
  });

  $(document).on("click", ".add_person", add_person);

  $(document).on("click", ".remove_person", function () {
    $(this).parents(".person_row").remove();
  });

  $(document).on("change", "#proxy_type", function () {
    if ($(this).val() == "None") {
      $("#proxy_row").addClass("d-none");
    } else {
      $("#proxy_row").removeClass("d-none");
    }
  });

  $(document).on("change", ".select_item", function () {
    if ($(".select_item:checked").length > 0) {
      if ($(".select_item:checked").length == $(".select_item").length) {
        $("#select_all").prop("checked", true);
      }
      $("#bulk_actions_row").css("visibility", "visible");
    } else {
      $("#select_all").prop("checked", false);
      $("#bulk_actions_row").css("visibility", "hidden");
    }
  });

  $(document).on("click", ".delete_item_btn", function () {
    $("#remove_item_modal")
      .find(".btn-danger")
      .attr("id", '["' + $(this).parents("tr").attr("id") + '"]');
    $("#remove_item_modal_title").text("Delete " + $(this).parents("tr").children(":first").text());
    $("#remove_item_modal").addClass(["d-flex", "justify-content-center"]);
    $("#remove_item_modal")
      .find("p")
      .html(
        "Are you sure you want to delete this item? <br />This action will delete the file itself too!",
      );
    $("#remove_item_modal").modal("show");
  });

  $(document).on("click", ".edit_metadata_btn", function () {
    if (
      ["MP3", "OPUS", "FLAC", "OGG", "MP4", "M4A", "WAV"].indexOf(
        $(this).parents("td").siblings(".td_ext").text(),
      ) > -1
    ) {
      socket.emit("edit_metadata", $(this).parents("tr").attr("id"));
    }
  });

  $(document).on("click", ".edit_file_btn", function () {
    socket.emit("edit_file", $(this).parents("tr").attr("id"));
  });

  $(document).on("click", ".download_item_btn", function () {
    let id = $(this).parents("tr").attr("id");
    socket.emit("download_item", id);
  });

  $(document).on("click", ".play_item_btn", function () {
    let id = $(this).parents("tr").attr("id");
    socket.emit("play_item", id);
  });

  $(document).on("click", ".find_item_btn", function () {
    let id = $(this).parents("tr").attr("id");
    let visible = ["files", "directories"];
    socket.emit("show_file_browser_", visible, id);
  });

  $(document).on("click", ".move_item_btn", function () {
    let id = $(this).parents("tr").attr("id");
    let visible = ["directories"];
    socket.emit("show_file_browser_", visible, id);
  });

  $(document).on("click", "#fetch_mbp_release_btn", function () {
    let release_id = $(this).parent().siblings("input").val();
    if (release_id.length > 0) {
      $(".remove_person").parents(".person_row").remove();
      socket.emit("fetch_mbp_release", release_id);
    } else {
      $("p:contains('* All input fields with an *, are optional')").text(
        "<p>Enter a Musicbrainz ID!</p>",
      );
    }
  });

  $(document).on("click", "#fetch_mbp_album_btn", function () {
    let album_id = $(this).parent().siblings("input").val();
    if (album_id.length > 0) {
      socket.emit("fetch_mbp_album", album_id);
    } else {
      $("p:contains('* All input fields with an *, are optional')").text(
        "<p>Enter a Musicbrainz ID!</p>",
      );
    }
  });

  $(document).on("click", "#fetch_spotify_track", function () {
    let track_id = $(this).parent().siblings("input").val();
    if (track_id.length > 0) {
      socket.emit("fetch_spotify_track", track_id);
    } else {
      $("p:contains('* All input fields with an *, are optional')").text(
        "<p>Enter a Spotify track ID!</p>",
      );
    }
  });

  $(document).on("click", "#fetch_deezer_track", function () {
    let track_id = $(this).parent().siblings("input").val();
    if (track_id.length > 0) {
      socket.emit("fetch_deezer_track", track_id);
    } else {
      $("p:contains('* All input fields with an *, are optional')").text(
        "<p>Enter a Deezer track ID!</p>",
      );
    }
  });

  $(document).on("click", "#fetch_genius_song", function () {
    let song_id = $(this).parent().siblings("input").val();
    if (song_id.length > 0) {
      socket.emit("fetch_genius_song", song_id);
    } else {
      $("p:contains('* All input fields with an *, are optional')").text(
        "<p>Enter a Genius song ID!</p>",
      );
    }
  });

  $(document).on("click", "#fetch_genius_album", function () {
    let album_id = $(this).parent().siblings("input").val();
    if (album_id.length > 0) {
      socket.emit("fetch_genius_album", album_id);
    } else {
      $("p:contains('* All input fields with an *, are optional')").text(
        "<p>Enter a Genius song ID!</p>",
      );
    }
  });

  $(document).on("click", "#edit_metadata_btn_modal", function () {
    if ($("#metadata_section").find("input[required]").val() == "") {
      $("#metadata_log").text("Fill all required fields!");
    } else if ($("#output_name").val().startsWith("tmp_")) {
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
      $("#metadata_log").text("Your output name can not begin with tmp_!");
    } else {
      let people = {};
      let filepath = $("#item_filepath").val();
      let id = $("#edit_item_modal").attr("item_id");
      let trackid =
        $("#spotify_trackid").length > 0 ? $("#spotify_trackid").val() : $("#mbp_releaseid").val();
      let albumid =
        $("#spotify_albumid").length > 0 ? $("#spotify_albumid").val() : $("#mbp_albumid").val();
      let source = $("#spotify_trackid").length > 0 ? "Spotify" : "Musicbrainz";
      $.each($(".artist_relations"), function () {
        if (
          $(this).val().trim().length < 1 ||
          $(this).parent().siblings().find(".artist_relations").val().trim().length < 1
        ) {
          return;
        } else {
          // Get ID by removing all letters from the ID, so the number remains
          let id = $(this)
            .parents(".person_row")
            .attr("id")
            .replace(/[a-zA-Z]/g, "");
          if (this.id.replace(/[0-9]/g, "") == "artist_relations_name") {
            people[id].name = $(this).val();
          } else {
            people[id].type = $(this).val();
          }
        }
      });

      let metadata = {
        trackid: trackid,
        albumid: albumid,
        title: $("#md_title").val(),
        artists: $("#md_artists").val(),
        album: $("#md_album").val(),
        album_artists: $("#md_album_artists").val(),
        album_tracknr: $("#md_album_tracknr").val(),
        album_releasedate: $("#md_album_releasedate").val(),
        cover: $("#md_cover").val(),
        people: JSON.stringify(people),
        source: source,
      };
      socket.emit("edit_metadata_request", metadata, filepath, id);
      $("#progress_edit").attr({
        "aria-valuenow": "66",
        "aria-valuemin": "0",
        style: "width: 66%",
      });
      $("#progress_text_edit").text("Skipping download and processing, adding metadata...");
      $("#download_section, #metadata_section, #edit_metadata_btn_modal").addClass("d-none");
      $("#progress_section").removeClass("d-none");
    }
  });

  $(document).on("click", "#edit_file_btn_modal", function () {
    $("#download_section").find("h5").after('<p class="text-center" id="edit_file_log"></p>');
    if ($(".timestamp_input").val() == "" && !$("#segments_check").is(":checked")) {
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
      $("#edit_file_log").text("Enter all segment fields or disable the segments");
    } else {
      let url = $("#edit_item_modal").attr("ytid");
      let ext = $("#extension").val();
      let output_folder = $("#output_folder").val();
      let type = $("#type").val();
      let output_format = "tmp_" + $("#output_name").val();
      let bitrate = $("#bitrate").val();
      let width = $("#width").val();
      let height = $("#height").val();
      var skip_fragments = [];
      if (!$("#segments_check").is(":checked")) {
        $.each($(".timestamp_input"), function (key, value) {
          if (value.id.slice(0, 12) == "segment_start") {
            let id = value.id.slice(13);
            skip_fragments[id] = { start: value.value };
          } else if (value.id.slice(0, 10) == "segment_end") {
            let id = value.id.slice(11);
            skip_fragments[id].end = value.value;
          }
        });
      }
      skip_fragments = JSON.stringify(
        $.grep(skip_fragments, function (n) {
          return n == 0 || n;
        }),
      );
      let proxy_data = JSON.stringify({
        proxy_type: $("#proxy_type").val(),
        proxy_address: $("#proxy_type").val() == "None" ? "" : $("#proxy_address").val(),
        proxy_port: $("#proxy_type").val() == "None" ? "" : $("#proxy_port").val(),
        proxy_username: $("#proxy_type").val() == "None" ? "" : $("#proxy_username").val(),
        proxy_password: $("#proxy_type").val() == "None" ? "" : $("#proxy_password").val(),
      });
      $("#progress_status").siblings("p").empty();
      data = {
        url: url,
        ext: ext,
        output_folder: output_folder,
        output_format: output_format,
        type: type,
        bitrate: bitrate,
        skip_fragments: skip_fragments,
        proxy_data: proxy_data,
        width: width,
        height: height,
      };
      socket.emit("ytdl_download", data, function (ack) {
        if (ack == "OK") {
          $("#metadata_section, #download_section, #edit_file_btn_modal").addClass("d-none");
          $("#progress_section").removeClass("d-none");
        }
      });
    }
  });

  $(document).on("click", ".youtube_result", function () {
    let link = $(this).find(".youtube_link").attr("href");
    socket.emit("ytdl_search", link);
    $("#default_view").children("ul").remove();
    $("#search_log, #progress_text").empty();
    $("#default_view").addClass(["d-none", "justify-content-center"]);
    $("#default_view").removeClass("d-none");
    spinner("Loading", $("#default_view").empty());
    // Reset the modal
    $("#progress").attr("aria-valuenow", "0").css("width", "0");
    $("#search_video_modal_footer, #metadata_view, #progress_view, #download_file_btn").addClass(
      "d-none",
    );
    $(".remove_person").parents(".person_row").remove();
    $("#metadata_view").find("input").val("");
  });

  $(document).on("click", "#output_folder_btn", function () {
    $("#download_modal").modal("hide");
    let id = "-1";
    let visible = ["directories"];
    socket.emit("show_file_browser_", visible, id);
  });

  $(document).on("keyup", ".directory_input", function (e) {
    e.preventDefault();
    let match = '^[^<>:;,?"*|/]+$';
    if (!$(this).val().match(match) && $(this).val() != "") {
      e.preventDefault();
      $("#file_browser_log").text("Directory contains invalid characters!");
      $(this).parent().parent().siblings(":last-child").children("button").addClass("disabled");
      $(this).parent().parent().siblings(":last-child").children("button").attr("disabled", "");
    } else if ($(this).val() == "") {
      $("#file_browser_log").text("");
      $(this).parent().parent().siblings(":last-child").children("button").addClass("disabled");
      $(this).parent().parent().siblings(":last-child").children("button").attr("disabled", "");
    } else {
      $("#file_browser_log").text("");
      $(this).parent().parent().siblings(":last-child").children("button").removeClass("disabled");
      $(this).parent().parent().siblings(":last-child").children("button").removeAttr("disabled");
    }
  });

  $(document).on("click", ".create_directory_btn", function () {
    let directory_name = $(this)
      .parent()
      .siblings(":first-child")
      .find("input.directory_input")
      .val();
    let current_directory = $("#file_browser_title").children("span").text();
    let new_row = $(this).parents("tr");
    socket.emit("create_directory", current_directory, directory_name, function (response) {
      $("#file_browser_log").text(response.msg);
      if (response.status == 200) {
        new_row.attr("filepath", response.filepath);
        let icon = document.createElement("i");
        let span = document.createElement("span");
        let nbsp = document.createTextNode("\u00A0");
        span.innerText = directory_name;
        icon.classList.add("bi", "bi-folder-fill");
        new_row.children(":first-child").empty();
        new_row.children(":first-child").append(icon, nbsp, span);
        new_row.find("button").tooltip("hide");
        new_row.find("button").remove();
      }
    });
  });

  $(document).on("click", ".remove_folder", function (e) {
    e.stopPropagation();
    $(this).popover("toggle");
  });

  $(document).on("click", ".cancel_removal", function () {
    $(this).parents("a.remove_folder").popover("hide");
  });

  $(document).on("click", ".confirm_removal", function () {
    let directory = $(this).parents(".btn-group").attr("filepath");
    if (directory == "new") {
      $('tr.directory[filepath="new"]').remove();
    } else {
      socket.emit("remove_directory", directory, function (response) {
        $("#file_browser_log").text(response.msg);
        if (response.status == 200) {
          $('tr.directory:contains("' + response.directory + '")').remove();
        }
      });
    }
  });

  $(document).on("click", ".file_browser_row", function () {
    if ($(this).hasClass("directory")) {
      if ($(this).find("input.directory_input").length < 1) {
        let directory_path = $(this).attr("filepath");
        let id = $("#file_browser_modal").attr("item");
        let visible = $("#filename_form").hasClass("d-none")
          ? ["files", "directories"]
          : ["directories"];
        socket.emit("show_file_browser_", visible, id, directory_path);
      }
    } else {
      if ($(this).hasClass("selected_row")) {
        $(this).removeClass("selected_row");
        $("#select_file_btn").addClass("disabled");
        $("#select_file_btn").attr("disabled", "");
        $("#selected_file").text("");
      } else if ($(".selected_row").length > 0) {
        $(".selected_row").removeClass("selected_row");
        $(this).addClass("selected_row");
        $("#selected_file").text("Selected file " + $(this).find("span").text());
      } else {
        $(this).toggleClass("selected_row");
        $("#select_file_btn").removeClass("disabled");
        $("#select_file_btn").removeAttr("disabled");
        $("#selected_file").text("Selected file " + $(this).find("span").text());
      }
    }
  });

  $("#file_browser_up").on("click", function () {
    let current_directory = $("#file_browser_title").children("span").text();
    let id = $("#file_browser_modal").attr("item");
    let visible = $("#filename_form").hasClass("d-none")
      ? ["files", "directories", "parent"]
      : ["directories", "parent"];
    socket.emit("show_file_browser_", visible, id, current_directory);
  });

  $("#select_file_btn").on("click", function () {
    let selected_file = $(".selected_row").attr("filepath");
    let id = $("#file_browser_modal").attr("item");
    socket.emit("update_file", selected_file, id);
  });

  $("#filename_form").on("submit", function (e) {
    e.preventDefault();
    let filename = $("#filename").val();
    let directory = $("#file_browser_title").children("span").text();
    let id = $("#file_browser_modal").attr("item");
    let overwrite = $("#overwrite_check").is(":checked") ? true : false;
    socket.emit("move_file", directory, filename, id, overwrite, function (msg) {
      $("#file_browser_log").text(msg);
    });
  });

  $("#close_file_browser_btn").on("click", function () {
    $("#file_browser_modal").modal("hide");
    if ($("#file_browser_modal").attr("item") === "-1") {
      $("#download_modal").modal("show");
    }
  });

  $("#select_directory_btn").on("click", function () {
    let directory = $("#file_browser_title").children("span").text();
    $("#output_folder").val(directory);
    $("#file_browser_modal").modal("hide");
    $("#download_modal").modal("show");
  });
  $("#download_modal").on("shown.bs.modal", function () {
    $("body").addClass("modal-open"); // for some reason it doesn't add this class, making the screen unscrollable, which is why I'm adding this manually
  });

  $(".add_folder").on("click", function () {
    item = {
      filepath: "new",
      filename: "",
      last_modified: Date.now() / 1000,
      filesize: 0,
      path_type: "directory",
      create_new_folder: true,
    };
    insert_file_browser_item(item);
  });

  $("#filename").on("keyup", function (e) {
    let match = '^[^<>:;,?"*|/]+$';
    if (!$(this).val().match(match) && $(this).val() != "") {
      e.preventDefault();
      $("#file_browser_log").text("Filename contains invalid characters!");
      $("#submit_filename").addClass("disabled");
      $("#submit_filename").attr("disabled", "");
    } else if ($(this).val() == "") {
      $("#file_browser_log").text("");
      $("#submit_filename").addClass("disabled");
      $("#submit_filename").attr("disabled", "");
    } else {
      $("#file_browser_log").text("");
      $("#submit_filename").removeClass("disabled");
      $("#submit_filename").removeAttr("disabled");
    }
  });

  $("#next_btn").on("click", function () {
    if ($(".timestamp_input").val() == "" && !$("#segments_check").is(":checked")) {
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
      $("#search_log").text("Enter all segment fields or disable the segments");
    } else if ($("#audio_col").length > 0) {
      $("#audio_col, #edit_metadata, #download_btn, #reset_view_btn").removeClass("d-none");
      $("#next_btn, #ytcol").addClass("d-none");
    } else if ($("#output_name").val().startsWith("tmp_")) {
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
      $("#search_log").text("Your output name can not begin with tmp_!");
    } else if (
      $("#proxy_type").val() != "None" &&
      $("#proxy_row").find("input[required]").val() == ""
    ) {
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
      $("#search_log").text("Enter a proxy port and address!");
    } else {
      let args = {
        title:
          $("#track_span").text() != "Unknown"
            ? $("#track_span").text()
            : $(".media-body").children("h5").text().replace("(Official Video)", "").trim(),
        artist:
          $("#artist_span").text() != "Unknown"
            ? $("#artist_span").text()
            : $("#channel_span").text(),
        type: "webui",
      };
      socket.emit("search_metadata", args);
      $("#search_log, #progress_text").empty();
      $("#default_view").addClass(["d-flex", "justify-content-center"]);
      spinner("Loading metadata...", $("#default_view"));
      $("#search_video_modal_footer, #ytcol").addClass("d-none");
    }
  });

  $("#select_all").on("click", function (e) {
    if ($(".select_item").length > 0) {
      if ($(this).is(":checked")) {
        $("#bulk_actions_row").css("visibility", "visible");
        $(".select_item").prop("checked", true);
      } else {
        $("#bulk_actions_row").css("visibility", "hidden");
        $(".select_item").prop("checked", false);
      }
    } else {
      e.preventDefault();
    }
  });

  $("#download_items").on("click", function () {
    let items = [];
    for (let i = 0; i < $(".select_item:checked").length; i++) {
      items.push($($(".select_item:checked")[i]).parents("tr").attr("id"));
    }
    socket.emit("download_items", items);
  });

  $("#delete_items").on("click", function () {
    let items = [];
    for (let i = 0; i < $(".select_item:checked").length; i++) {
      items.push($($(".select_item:checked")[i]).parents("tr").attr("id"));
    }
    $("#remove_item_modal").find(".btn-danger").attr("id", JSON.stringify(items));
    $("#remove_item_modal_title").text("Deleting " + items.length + " items");
    $("#remove_item_modal")
      .find("p")
      .html(
        "Are you sure you want to delete these items? <br />This action will delete the files themselves too!",
      );
    $("#remove_item_modal").modal("show");
  });

  $("#del_item_btn_modal").on("click", function () {
    let items = JSON.parse(this.id);
    socket.emit("delete_item", this.id, function (ack) {
      if (ack == "OK") {
        for (let i = 0; i < items.length; i++) {
          $("tr#" + items[i]).remove();
        }
        $("#remove_item_modal").modal("hide");
      }
    });
  });

  $("#query_form").on("submit", function (e) {
    e.preventDefault();
    $("#search_song_btn").trigger("click");
  });

  $("#metadata_query_form").on("submit", function (e) {
    e.preventDefault();
    $("#search_metadata_btn").trigger("click");
  });

  $("#search_song_btn").on("click", function () {
    // Send request to the server
    let query = $("#query").val();
    socket.emit("ytdl_search", query);
    $("#search_log, #progress_text").empty();
    $("#default_view").removeClass("d-none");
    $("#default_view").addClass(["d-flex", "justify-content-center"]);
    $("#default_view").children(".youtube_result").remove();
    spinner("Loading...", $("#default_view"));
    // Reset the modal
    $("#progress").attr("aria-valuenow", "0").css("width", "0");
    $(
      "#search_video_modal_footer, #metadata_view, #progress_view, #download_file_btn, #search_metadata_view, #genius_btn",
    ).addClass("d-none");
    $(".remove_person").parents(".person_row").remove();
    $("#metadata_view").find("input").val("");
    $("#ytcol, #audio_col").empty();
  });

  $("#download_btn").on("click", function (e) {
    if (
      $(".audio_col-checkbox:checked").length < 1 &&
      $("#audio_col").length > 0 &&
      !$("#extension option:selected").hasAttr("nosupport")
    ) {
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
      $("#search_log").text("Select a release on the right side before downloading a video");
    } else if ($(".timestamp_input").val() == "" && !$("#segments_check").is(":checked")) {
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
      $("#search_log").text("Enter all segment fields or disable the segments");
    } else if (
      $("#audio_col").length < 1 &&
      $("#metadata_view").find("input[required]").val() == "" &&
      !$("#extension option:selected").hasAttr("nosupport")
    ) {
      $("#metadata_log").text("Enter all required fields!");
    } else {
      let url = $("#thumbnail_yt").attr("url");
      let ext = $("#extension").val();
      let output_folder = $("#output_folder").val();
      let type = $("#type").val();
      let output_format = $("#output_name").val();
      let bitrate = $("#bitrate").val();
      let width = $("#width").val();
      let height = $("#height").val();
      var skip_fragments = [];
      if (!$("#segments_check").is(":checked")) {
        $.each($(".timestamp_input"), function (key, value) {
          if (value.id.slice(0, 12) == "segment_start") {
            let id = value.id.slice(13);
            skip_fragments[id] = { start: value.value };
          } else if (value.id.slice(0, 10) == "segment_end") {
            let id = value.id.slice(11);
            skip_fragments[id].end = value.value;
          }
        });
      }
      skip_fragments = JSON.stringify(
        $.grep(skip_fragments, function (n) {
          return n == 0 || n;
        }),
      );
      let proxy_data = JSON.stringify({
        proxy_type: $("#proxy_type").val(),
        proxy_address: $("#proxy_type").val() == "None" ? "" : $("#proxy_address").val(),
        proxy_port: $("#proxy_type").val() == "None" ? "" : $("#proxy_port").val(),
        proxy_username: $("#proxy_type").val() == "None" ? "" : $("#proxy_username").val(),
        proxy_password: $("#proxy_type").val() == "None" ? "" : $("#proxy_password").val(),
      });
      $("#progress_status").siblings("p").empty();
      data = {
        url: url,
        ext: ext,
        output_folder: output_folder,
        output_format: output_format,
        type: type,
        bitrate: bitrate,
        skip_fragments: skip_fragments,
        proxy_data: proxy_data,
        width: width,
        height: height,
      };
      socket.emit("ytdl_download", data, function (ack) {
        if (ack == "OK") {
          $(
            "#edit_metadata, #download_btn, #search_metadata_view, #404p, #default_view, #reset_view_btn, #genius_btn, #audio_col, #save_metadata, #metadata_view, #genius_col",
          ).addClass("d-none");
          $("#progress_view").removeClass("d-none");
          $("#search_log").empty();
          progress_text =
            $("#edit_item_modal").css("display").toLowerCase() != "none"
              ? $("#progress_text_edit")
              : $("#progress_text");
        }
      });
    }
  });

  $("#search_item").on("keyup", function () {
    var table = $("#record_stable").children("tbody").clone(true, true);
    if ($(this).val().length > 2) {
      socket.emit("search_item", $(this).val());
    } else if ($(this).val() == "") {
      socket.emit("fetch_all_items");
    }
  });

  $("#add_video").on("click", function () {
    if ($("#progress").text() == "100%") {
      $("#default_view, #download_btn").removeClass("d-none");
      $(
        "#progress_view, #download_file_btn, #search_video_modal_footer, #search_metadata_view, #404p",
      ).addClass("d-none");
      $("#progress_text, #progress").text("");
      $("#progress").attr({
        "aria-valuenow": "0",
        "aria-valuemin": "0",
        style: "",
      });
    }
    $("#progress_view").addClass("d-none");
    $("#download_modal").addClass(["d-flex", "justify-content-center"]);
    $("#download_modal").modal("toggle");
  });

  $("#download_modal, #remove_item_modal, #edit_item_modal").on("hidden.bs.modal", function () {
    $(this).removeClass(["d-flex", "justify-content-center"]);
  });

  $("#download_file_btn").on("click", function () {
    socket.emit("download_item", $(this).attr("filepath"));
  });

  $("#reset_view_btn").on("click", function () {
    if ($("#ytcol").children().length > 0) {
      $("#default_view, #ytcol, #next_btn").removeClass("d-none");
      $(
        "#progress_view, #audio_col, #reset_view_btn, #edit_metadata, #download_btn, #metadata_view, #genius_btn",
      ).addClass("d-none");
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
    } else {
      $("#default_view, #search_log").empty();
    }
  });

  $("#genius_btn").on("click", function () {
    if ($(".audio_col-checkbox:checked").length < 1 && $("#audio_col").length > 0) {
      $("#download_modal").animate({ scrollTop: 0 }, "fast");
      $("#search_log").text("Select a release on the right side before searching for lyrics");
    } else {
      $("#audio_col").addClass("d-none");
      let args = {
        title:
          $("#track_span").text() != "Unknown"
            ? $("#track_span").text()
            : $(".media-body").children("h5").text(),
        artist:
          $("#artist_span").text() != "Unknown"
            ? $("#artist_span").text()
            : $("#channel_span").text(),
        type: "lyrics",
      };
      spinner("Loading Genius data...", $("#default_view"));
      socket.emit("search_metadata", args);
      $("#search_metadata_view, #search_video_modal_footer").addClass("d-none");
    }
  });

  $("#search_metadata_btn").on("click", function () {
    let args = {
      title: $("#metadata_query").val(),
      artist: "",
      type: "webui",
    };
    socket.emit("search_metadata", args);
    // $("#default_view").children('#audio_col').remove();
    spinner("Loading metadata...", $("#default_view"));
  });

  socket.on("download_progress", function (msg) {
    $("#edit_metadata, #next_btn, #default_view, #ytcol").addClass("d-none");
    $("#progress_view").removeClass("d-none");
    $("#search_log").empty();
    // var progress_text = $("#edit_item_modal").css('display').toLowerCase() != 'none' ? $("#progress_text_edit") : $("#progress_text");

    if (msg.total_bytes != "Unknown") {
      if (msg.downloaded_bytes / msg.total_byes == 1) {
        progress_text.text("Extracting audio...");
        setProgress(100 / getPhases());
      } else {
        progress_text.text("Downloading...");
        let percentage = Math.round(((msg.downloaded_bytes / msg.total_bytes) * 100) / getPhases());
        setProgress(percentage);
      }
    } else {
      progress_text.text("Downloading...");
    }
  });

  socket.on("finished_download", function () {
    let percentage = 100 / getPhases();
    setProgress(percentage);
    progress_text.text("Extracting audio...");
  });

  socket.on("postprocessing", function (msg) {
    if (msg.postprocessor == "ModifyChapters") {
      let percentage = (100 / getPhases()) * 2;
      setProgress(percentage);
      progress_text.text("Cutting segments from the video... ");
    } else if (msg.postprocessor == "MoveFiles") {
      let percentage = (100 / getPhases()) * 3;
      setProgress(percentage);
      progress_text.text("Moving the files to its destination... ");
    }
  });

  socket.on("finished_postprocessor", function (msg) {
    if (msg.postprocessor == "MoveFiles") {
      let percentage = (100 / getPhases()) * (getPhases() - 1);
      setProgress(percentage);
      progress_text.text("Adding metadata...");
      var filepath = msg.filepath;
      if ($("#edit_item_modal").css("display").toLowerCase() == "none") {
        socket.emit("merge_data", getMetadata(), filepath);
      } else {
        let item_id = $("#edit_item_modal").attr("item_id");
        socket.emit("edit_file_request", filepath, item_id);
      }
    }
  });

  socket.on("finished_metadata", function (msg) {
    setProgress("100");
    progress_text.text("Finished adding metadata!");
    msg.data["ytid"] = $("#thumbnail_yt").attr("ytid");
    try {
      socket.emit("insert_item", msg.data);
      $("#download_file_btn").removeClass("d-none");
      $("#download_file_btn").attr("filepath", msg.data["filepath"]);
    } catch (error) {
      console.error(error);
    }
  });

  socket.on("metadata_unavailable", function (msg) {
    msg.data["ytid"] = $("#thumbnail_yt").attr("ytid");
    progress_text.text(
      "Metadata has NOT been added, because metadata is not supported for the selected extension",
    );
    setProgress("100");
    $("#download_file_btn").removeClass("d-none");
    $("#download_file_btn").attr("filepath", msg.data["filepath"]);
    socket.emit("insert_item", msg.data);
  });

  socket.on("download_error", function (msg) {
    progress_text.text(msg.message);
    getProgress().attr("aria-valuenow", 100);
    getProgress().html('ERROR <i class="fi-cwluxl-smiley-sad-wide" aria-hidden="true"></i>');
    getProgress().css("width", "100%");
    progress_text.text(msg.message);
    if ($("#edit_item_modal").css("display").toLowerCase() != "block") {
      $("#reset_view_btn").removeClass("d-none");
    }
  });

  socket.on("ytdl_response", (video, download_form, metadata_form) => {
    console.info("Got YouTube info");
    $("#metadata_view").empty().prepend(metadata_form);
    insertYTcol(video, download_form);
    output_template();
    yt_data = video;
  });

  socket.on("mbp_response", (mbp) => {
    console.info("Got musicbrainz info");
    mbp_data = mbp;
    $("#search_metadata_view").removeClass("d-none");
    if (Object.keys(mbp).length > 0) {
      $("#audio_col").empty();
      for (let i = 0; i < Object.keys(mbp).length - 2; i++) {
        insert_musicbrainz_data(mbp[i]);
      }
      $("#metadata_query").val(mbp["query"]);
    } else if ($("#404p").hasClass("d-none")) {
      $("#default_view").children(".spinner-border").remove();
      $("#next_btn, #otherp").addClass("d-none");
      $(
        "#404p, #search_video_modal_footer, #edit_metadata, #reset_view_btn, #genius_btn",
      ).removeClass("d-none");
    }
    $("#search_video_modal_footer").removeClass("d-none");
  });

  socket.on("spotify_response", (spotify) => {
    console.info("Spotify info");
    spotify_data = spotify;
    $("#search_metadata_view").removeClass("d-none");
    if (spotify["tracks"]["items"].length > 0) {
      $("#audio_col").empty();
      for (let i = 0; i < spotify["tracks"]["items"].length; i++) {
        insert_spotify_data(spotify["tracks"]["items"][i]);
      }
      $("#metadata_query").val(spotify_data["query"]);
      $("#search_video_modal_footer, #edit_metadata").removeClass("d-none");
    } else if ($("#404p").hasClass("d-none")) {
      $("#default_view").children(".spinner-border").remove();
      $("#next_btn, #otherp").addClass("d-none");
      $(
        "#404p, #search_video_modal_footer, #edit_metadata, #reset_view_btn, #genius_btn",
      ).removeClass("d-none");
    }
  });

  socket.on("deezer_response", (deezer) => {
    console.info("Deezer info");
    deezer_data = deezer;
    $("#search_metadata_view").removeClass("d-none");
    if (deezer.length > 0) {
      $("#audio_col").empty();
      for (let i = 0; i < deezer.length - 2; i++) {
        insert_deezer_data(deezer[i]);
        $("#search_video_modal_footer, #edit_metadata").removeClass("d-none");
      }
      $("#metadata_query").val(deezer[deezer.length - 1]);
    } else if ($("#404p").hasClass("d-none")) {
      $("#default_view").children(".spinner-border").remove();
      $("#next_btn, #otherp").addClass("d-none");
      $(
        "#404p, #search_video_modal_footer, #edit_metadata, #reset_view_btn, #genius_btn",
      ).removeClass("d-none");
    }
  });

  socket.on("genius_response", (genius) => {
    console.info("Genius info");
    genius_data = genius;
    if (genius_data["hits"].length > 0) {
      for (let i = 0; i < genius["hits"].length; i++) {
        insert_genius_data(genius["hits"][i]["result"]);
        $("#search_video_modal_footer, #edit_metadata, #metadata_view_btn").removeClass("d-none");
      }
      $("#genius_btn").addClass("d-none");
    } else {
      $("#default_view").children(".spinner-border").remove();
      $("#next_btn, #otherp, #genius_btn").addClass("d-none");
      $("#404p, #search_video_modal_footer, #edit_metadata, #reset_view_btn").removeClass("d-none");
    }
  });

  socket.on("template", (response) => {
    data = response;
    response = JSON.parse(response);
    $("#extension").val([]);
    $("#extension")
      .children("[label='" + response.type + "']")
      .children("[value='" + response.extension + "']")
      .prop("selected", true);
    $("#type").val(response.type);
    $("#output_folder").val(response.output_folder);
    $("#output_name").val(response.output_name);
    $("#bitrate").val(response.bitrate);
    $("#proxy_type").val(response.proxy_type ? $("#proxy_status") != false : "None");
    $("#proxy_address").val(response.proxy_address);
    $("#proxy_port").val(response.proxy_port);
    $("#proxy_username").val(response.proxy_username);
    $("#proxy_password").val(response.proxy_password);
    if (response.proxy_status == true) {
      $("#proxy_row").removeClass("d-none");
    } else {
      $("#proxy_row").addClass("d-none");
    }
    if (response.type == "Video") {
      $("#video_row").removeClass("d-none");
      $("#resolution").children("option:selected").prop("selected", false);
      $("#resolution")
        .children("option[value='" + response.resolution + "']")
        .prop("selected", true);
      if (response.resolution.split(";").indexOf("best") > -1) {
        $("#width").val("best");
        $("#height").val("best");
        $("#resolution").parent().siblings().addClass("d-none");
      } else {
        $("#width").val(response.resolution.split(";")[0]);
        $("#height").val(response.resolution.split(";")[1]);
      }
    } else {
      $("#video_row").addClass("d-none");
    }
  });

  socket.on("found_mbp_release", (data) => {
    let mbp = JSON.parse(data);
    let title = mbp["release"].title;
    let tags = "";
    let artists = "";

    let album = mbp["release"]["release-group"]["title"];
    let album_releasedate = mbp["release"]["release-group"]["date"];
    let album_id = mbp["release"]["release-group"]["id"];

    $.each(mbp["release"]["artist-credit"], function (key, value) {
      if (typeof value != "string") {
        artists += value.artist.name.trim() + "; ";
      }
    });
    $.each(mbp["release"]["release-group"]["tag-list"], function (key, value) {
      tags += value.name.trim() + "; ";
    });
    tags = tags.trim().slice(0, tags.trim().length - 1);
    artists = artists
      .trim()
      .slice(0, artists.trim().length - 1)
      .replace("/", ";");
    $("#md_title").val(title);
    $("#md_artists").val(artists);
    $("#md_album").val(album);
    $("#md_album_releasedate").val(album_releasedate);
    $("#mbp_albumid").val(album_id);

    if (
      "artist-relation-list" in mbp["release"] &&
      mbp["release"]["artist-relation-list"].length > 0
    ) {
      $.each(mbp["release"]["artist-relation-list"], function (key, value) {
        let name = value.artist.name;
        let type = value.type;
        if (
          $(".person_row").length > 1 ||
          $("#artist_relations_name0").val() != "" ||
          $("#artist_relations_type0").val() != ""
        ) {
          var row = add_person($(".add_person"));
          var row_id = row.attr("id").slice(row.attr("id").length - 1);
        } else {
          var row_id = "0";
        }

        $("#artist_relations_name" + row_id).val(name);
        $("#artist_relations_type" + row_id).val(type);
      });
    }
  });

  socket.on("found_mbp_album", (data) => {
    let mbp = JSON.parse(data);
    let artists = "";
    let tracknr = "";
    let release_cover = mbp["release_cover"]["images"][0]["thumbnails"]["small"];
    let release_date = mbp["release_group"]["release-group-list"][0]["first-release-date"];
    $.each(mbp["release_group"]["release-group-list"][0]["artist-credit"], function (key, value) {
      if (typeof value != "string") {
        artists += value.artist.name.trim() + "; ";
      }
    });
    $.each(mbp["release_group"]["release-group-list"][0]["release-list"], function (key, value) {
      if (value.title == mbp["release_group"]["release-group-list"][0].title) {
        tracknr = key + 1;
      }
    });
    artists = artists.trim().slice(0, artists.trim().length - 1);
    $("#md_cover").val(release_cover);
    $("#md_album_releasedate").val(release_date);
    $("#md_album_artists").val(artists);
    $("#md_album_tracknr").val(tracknr);
  });

  socket.on("spotify_track", (data) => {
    let artists = "";
    let album_artists = "";
    let cover = "";

    for (let i = 0; i < Object.keys(data["artists"]).length; i++) {
      artists += data["artists"][i]["name"] + "; ";
    }
    for (let i = 0; i < Object.keys(data["album"]["artists"]).length; i++) {
      album_artists += data["album"]["artists"][i]["name"] + "; ";
    }
    for (let i = 0; i < Object.keys(data["album"]["images"]).length; i++) {
      if (data["album"]["images"][i]["height"] == "300") {
        cover = data["album"]["images"][i]["url"];
      }
    }

    $("#md_title").val(data["name"]);
    $("#md_artists").val(artists.slice(0, artists.length - 2));
    $("#md_album").val(data["album"]["name"]);
    $("#md_album_artists").val(album_artists.slice(0, album_artists.length - 2));
    $("#md_album_tracknr").val(data["track_number"]);
    $("#md_album_releasedate").val(data["album"]["release_date"]);
    $("#spotify_albumid").val(data["album"]["id"]);
    $("#md_cover").val(cover);
  });

  socket.on("deezer_track", (data) => {
    let contributors = "";

    for (let i = 0; i < Object.keys(data["contributors"]).length; i++) {
      contributors += data["contributors"][i]["name"] + "; ";
    }
    $("#md_title").val(data["title"]);
    $("#md_artists").val(contributors);
    $("#md_album").val(data["album"]["title"]);
    $("#md_album_artists").val(data["artist"]["name"]);
    $("#md_album_tracknr").val(data["track_position"]);
    $("#md_album_releasedate").val(data["release_date"]);
    $("#spotify_albumid").val(data["album"]["id"]);
    $("#md_cover").val(data["album"]["cover_medium"]);
  });

  socket.on("genius_song", (data) => {
    console.log(data);
    let song_data = data["song"];
    let artists = song_data["primary_artist"]["name"] + "; ";
    for (let i = 0; i < song_data["featured_artists"].length; i++) {
      artists += song_data["featured_artists"][i]["name"] + "; ";
    }
    $("#md_title").val(song_data["title"]);
    $("#md_artists").val(artists.slice(0, artists.length - 2));
    $("#md_album").val(song_data["album"]["name"]);
    $("#md_cover").val(song_data["song_art_image_thumbnail_url"]);
    $("#md_album_releasedate").val(song_data["release_date"]);
    $("#genius_albumid").val(song_data["album"]["id"]);
  });

  socket.on("genius_album", (data) => {
    console.log(data);
    let album_tracks = data["tracks"];
    let album_artists = album_tracks[0]["song"]["primary_artist"]["name"] + "; ";
    for (let i = 0; i < album_tracks.length; i++) {
      if (album_tracks[i]["song"]["featured_artists"].length > 0) {
        for (let j = 0; j < album_tracks[i]["song"]["featured_artists"].length; j++) {
          album_artists += album_tracks[i]["song"]["featured_artists"][j]["name"] + "; ";
        }
      }
      if (album_tracks[i]["song"]["title"] == $("#md_title").val()) {
        $("#md_album_tracknr").val(i + 1);
      }
    }
    $("#md_album_artists").val(album_artists);
  });

  socket.on("search_video", (data) => {
    $("#default_view").find(".spinner-border").remove();
    $("#search_log").text(data);
    $("#default_view").removeClass("d-none");
    $("#progress_view, #ytcol, #audio_col").addClass("d-none");
    $("#download_modal").animate({ scrollTop: 0 }, "fast");
  });

  socket.on("overview", (data) => {
    if (data.msg == "inserted_song") {
      $("#overview_log").empty();
      add_item(data);
    } else if (data.msg == "download_file") {
      file_data = data.data;
      let blob = new Blob([file_data], { type: data.mimetype });
      let uri = URL.createObjectURL(blob);
      downloadURI(uri, data.filename);
    } else if (data.msg == "play_file") {
      let file_data = data.data;
      let item_data = data.item_data;
      let blob = new Blob([file_data], { type: data.mimetype });
      let uri = URL.createObjectURL(blob);
      ap.list.add([
        {
          name: item_data["name"],
          artist: item_data["artist"],
          url: uri,
          cover: item_data["cover"],
        },
      ]);
      ap.play();
      $("#record_stable").parent().css("height", "65vh");
      $("#audio_player").removeClass("d-none");
    } else if (data.msg == "changed_metadata") {
      socket.emit("update_item", data.data);
    } else if (data.msg == "changed_metadata_db") {
      let tr = $("tr#" + data.data.item_id);
      tr.find("img").attr("src", data.data.image);
      tr.find("img").siblings("span").text(data.data.name);
      tr.find(".td_artist").text(data.data.artist);
      tr.find(".td_album").text(data.data.album);
      tr.find(".td_date").text(data.data.date);
      tr.find(".td_filepath").text(
        data.data.filepath.split(".")[data.data.filepath.split(".").length - 1],
      );
      $("#overview_log").text("Item metadata has been changed!");
      $("#edit_item_modal").modal("hide");
    } else if (data.msg == "delete_items") {
      $(".select_item:checked").parents("tr").remove();
      $("#bulk_actions_row").css("visibility", "hidden");
      $("#select_all").prop("checked", false);
      $("#overview_log").text(data.data);
    } else if (data.msg == "show_file_browser_") {
      $("#file_browser_up").siblings("tr").remove();
      if (data.visible.indexOf("files") > -1) {
        $("#filename_form, #select_directory_btn, #submit_filename").addClass("d-none");
        $("#selected_file, #select_file_btn").removeClass("d-none");
        $("#browser_modal_title").text("Select a file");
      } else {
        $("#filename_form, #submit_filename").removeClass("d-none");
        $("#selected_file, #select_directory_btn, #select_file_btn").addClass("d-none");
        $("#browser_modal_title").text("Select a directory");
      }
      if (data.files.length > 0) {
        for (let i = 0; i < data.files.length; i++) {
          insert_file_browser_item(data.files[i]);
        }
      } else {
        let tr = document.createElement("tr");
        let td = document.createElement("td");
        td.setAttribute("colspan", 3);
        td.classList.add("text-dark", "text-center");
        td.innerHTML =
          data.visible.indexOf("files") > -1
            ? "No files or directories found with any of the following extensions: <br/> AAC, FLAC, MP3, M4A, OPUS, VORBIS, WAV, MP4, M4A, FLV, WEBM, OGG, MKV, AVI"
            : "No directories found";
        tr.append(td);
        $("#file_browser_up").after(tr);
      }
      if (data.id === "-1") {
        $("#filename_form, #select_file_btn").addClass("d-none");
        $("#select_directory_btn").removeClass("d-none");
      }
      $("#file_browser_title").children("span").text(data.directory);
      $("#file_browser_modal").attr("item", data.id);
      $("#file_browser_modal").modal("show");
    } else if (data.msg == "updated_filepath") {
      $("#file_browser_modal").modal("hide");
      $("#overview_log").text("File location succesfully updated to " + data["filepath"]);
    } else {
      $("#overview_log").text(data.msg);
    }
  });

  socket.on("edit_metadata", (data) => {
    $("#download_section, #metadata_section, #metadata_view").empty();
    $("#metadata_section").append(data.metadata_view);
    $("#metadata_section").find("#mbp_releaseid").val(data.metadata.musicbrainz_id);
    $("#metadata_section").find("#mbp_albumid").val(data.metadata.mbp_releasegroupid);
    $("#metadata_section").find("#md_title").val(data.metadata.title);
    $("#metadata_section").find("#md_artists").val(data.metadata.artists);
    $("#metadata_section").find("#md_album").val(data.metadata.album);
    $("#metadata_section").find("#md_album_artists").val(data.metadata.artists);
    $("#metadata_section").find("#md_album_tracknr").val(data.metadata.tracknr);
    $("#metadata_section").find("#md_album_releasedate").val(data.metadata.date);
    $("#metadata_section").find("#md_cover").val(data.metadata.cover);
    $("#metadata_section").prepend(
      '<div class="form-row"><div class="col"><label for="#item_file_path">Filepath of item:</label><input type="text" value="' +
        data.metadata.filename +
        '" class="form-control" id="item_filepath" style="cursor: not-allowed" disabled /></div></div>',
    );
    $("#edit_item_modal").attr("item_id", data.metadata.item_id);
    $("#edit_file_btn_modal").attr("id", "edit_metadata_btn_modal");
    $("#metadata_section, #edit_metadata_btn_modal").removeClass("d-none");
    $("#progress_section").addClass("d-none");
    $("#progress_edit").attr({
      "aria-valuenow": "0",
      "aria-valuemin": "0",
      style: "",
    });
    if (
      data.metadata.mbp_releasegroupid == "" &&
      data.metadata.mbp_releaseid == "" &&
      $("#spotify_trackid").length > 0
    ) {
      $("#spotify_trackid").val(data.metadata.audio_id);
    }

    $("#edit_item_modal").addClass(["d-flex", "justify-content-center"]);
    $("#edit_item_modal").modal("show");
  });

  socket.on("metadata_log", (msg) => {
    $("#metadata_log").text(msg);
  });

  socket.on("edit_file", (data) => {
    $("#download_section, #ytcol, #metadata_section").empty();
    $("#download_section").append(data.download_view);
    $("#progress_section").addClass("d-none");
    $("#progress_edit").attr({
      "aria-valuenow": "0",
      "aria-valuemin": "0",
      style: "",
    });
    $("#edit_metadata_btn_modal").attr("id", "edit_file_btn_modal");
    $("#download_section, #edit_file_btn_modal").removeClass("d-none");
    $("#download_section").find("hr").remove();
    $("#edit_item_modal").attr({
      item_id: data.file_data.item_id,
      ytid: data.file_data.youtube_id,
    });
    $("hr").addClass("d-none");

    $("#edit_item_modal").addClass(["d-flex", "justify-content-center"]);
    $("#edit_item_modal").modal("show");
  });

  socket.on("youtube_search", (data) => {
    search_data = data;
    $("#default_view").children().addClass("d-none");
    for (let i = 0; i < Object.keys(data.result).length; i++) {
      search_result(data.result[i]);
    }
  });

  socket.on("ytdl_template", (data) => {
    let extension = $("#extension").val().indexOf("m4a") > -1 ? "m4a" : $("#extension").val();
    let filename =
      data
        .split(".")
        .slice(0, data.split(".").length - 1)
        .join(".") +
      "." +
      extension;
    if ($("#filename_span").length > 0) {
      $("#filename_span").text("Filename: " + filename);
    } else {
      $("#album_span").after('<br/><span id="filename_span">Filename: ' + filename + "</span>");
    }
  });

  socket.on("search_item", (data) => {
    $("#record_stable").children("tbody").empty();
    if (data.length < 1) {
      let tr = document.createElement("tr");
      let td = document.createElement("td");
      let h5 = document.createElement("h5");
      td.setAttribute("colspan", "6");
      h5.textContent = "No items found!";
      h5.classList.add("text-center", "text-dark");
      td.append(h5);
      tr.append(td);
      $("#record_stable").children("tbody").append(tr);
    }
    for (let i = 0; i < data.length; i++) {
      add_item({ data: data[i] });
    }
  });

  ap.on("ended", function () {
    if ($(".aplayer-list").children("ol").children().length > 1) {
      ap.list.remove($(".aplayer-list-light").index() - 1);
    } else {
      ap.list.clear();
    }
  });
  ap.on("list_clear", function () {
    $("#record_stable").parent().css("height", "75vh");
    $("#audio_player").addClass("d-none");
  });
});
