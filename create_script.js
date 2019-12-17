class Library
{
    constructor(name, url)
    {
        this.name = name;
        this.url = url;
        this.dependencies = [];
        this.checkbox == null;
    }
}

var libraries = [];

// make sure the order in which these are pushed into the array is sensible!

libraries.push(new Library("imgui-lean","https://www.graphics.rwth-aachen.de:9000/ptrettner/imgui-lean.git"));
libraries.push(new Library("ctracer","https://www.graphics.rwth-aachen.de:9000/ptrettner/ctracer.git"));
libraries.push(new Library("polymesh","https://www.graphics.rwth-aachen.de:9000/ptrettner/polymesh.git"));
libraries.push(new Library("glfw","https://github.com/glfw/glfw.git"));
libraries.push(new Library("glow","https://www.graphics.rwth-aachen.de:9000/Glow/glow.git"));
libraries.push(new Library("glow-extras","https://www.graphics.rwth-aachen.de:9000/Glow/glow-extras.git"));
libraries.push(new Library("typed-geometry","https://www.graphics.rwth-aachen.de:9000/ptrettner/typed-geometry.git"));


function add_dependency(name, dependency)
{
    for(const lib of libraries)
    {
        if(lib.name == name)
        {   
            lib.dependencies.push(dependency);
        }
    }
}

add_dependency("glow-extras", "glow");
add_dependency("glow", "glfw");
add_dependency("glow", "typed-geometry");

function get_lib(name)
{
    for(const lib of libraries)
    {
        if(lib.name == name){
            return lib;
        }
    }
    return null;
}

function disable_lib(name)
{
    for(lib of libraries)
    {
        if(lib.dependencies.includes(name))
        {
            var othercb = lib.checkbox;
            othercb.checked = false;
            disable_lib(lib.name);
        }   
    }        
}

function enable_lib(name)
{
    lib = get_lib(name);
    for(const depend of lib.dependencies)
    {
        var othercb = get_lib(depend).checkbox;
        othercb.checked = true;
        enable_lib(depend);
    }    
}

function onCheckboxClicked(cb)
{
    var name = cb.value;
    if(cb.checked)
    {
       enable_lib(name);
    }
    else
    {
        disable_lib(name);
    }
}

function setupCheckboxes()
{
    container = document.getElementById("libraries_div");
    for(lib of libraries)
    {
        var checkbox = document.createElement("input");
        var cbId = lib.name + "Checkbox";
        checkbox.id = cbId;
        checkbox.type = "checkbox";
        checkbox.textContent = lib.name;
        checkbox.value = lib.name;
        checkbox.onclick = function(){onCheckboxClicked(this);};
        var label = document.createElement("label");
        label.setAttribute("for", cbId);
        label.innerHTML = lib.name;
        container.appendChild(checkbox);
        container.appendChild(label);
        container.appendChild(document.createElement("br"));
        lib.checkbox = checkbox;
    }
}

function download(filename, text) 
{
  var element = document.createElement('a');
  element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
  element.setAttribute('download', filename);

  element.style.display = 'none';
  document.body.appendChild(element);

  element.click();

  document.body.removeChild(element);
}

function onGenerateCommandClicked()
{
    document.getElementById("generated_command").innerHTML = generate_command();
}

function depends_on(lib, dependee)
{
    return lib.dependencies.includes(dependee.name);
}

function getEnabledLibraries()
{
    var libs = new Array();
    for(lib of libraries)
    {
        if(lib.checkbox && lib.checkbox.checked)
        {
            libs.push(lib);
        }
    }
    // insertion sort
    for (var i = 1; i < libs.length; i++) 
    {
        for(var j = i; j < libs.length; j++)
        {
            if(depends_on(libs[i], libs[j]))
            {
                var tmp = libs[i];
                libs[i] = libs[j];
                libs[j] = tmp;
            }
        }
    }
    return libs;
}

const copyToClipboard = str => {
    const el = document.createElement('textarea');  // Create a <textarea> element
    el.value = str;                                 // Set its value to the string that you want copied
    el.setAttribute('readonly', '');                // Make it readonly to be tamper-proof
    el.style.position = 'absolute';                 
    el.style.left = '-9999px';                      // Move outside the screen to make it invisible
    document.body.appendChild(el);                  // Append the <textarea> element to the HTML document
    const selected =            
      document.getSelection().rangeCount > 0        // Check if there is any content selected previously
        ? document.getSelection().getRangeAt(0)     // Store selection if found
        : false;                                    // Mark as false to know no selection existed before
    el.select();                                    // Select the <textarea> content
    document.execCommand('copy');                   // Copy - only works as a result of a user action (e.g. click events)
    document.body.removeChild(el);                  // Remove the <textarea> element
    if (selected) {                                 // If a selection existed before copying
      document.getSelection().removeAllRanges();    // Unselect everything on the HTML document
      document.getSelection().addRange(selected);   // Restore the original selection
    }
  };

function checkValidNameAndFolder()
{
    var projectName = document.getElementById("project_name_text_field").value;
    var projectFolder = document.getElementById("folder_name_text_field").value;

    if(!projectName)
    {
        window.alert("Project name is empty!");
        return false;        
    }

    if(!projectFolder)
    {
        window.alert("Project folder is empty!");
        return false;        
    }

    if(projectName.split(" ").length != 1)
    {
        window.alert("Project name must be a single word!");
        return false;
    }
    if(projectFolder.split(" ").length != 1){
        window.alert("Project folder must be a single word!");
        return false;
    }

    return true;
}

function onGenerateButtonClick()
{
    if(checkValidNameAndFolder())
    {
        var script = generate_script();
        var output = document.getElementById("output_textarea");
        output.innerHTML = script;
        copyToClipboard(script);
    }
}

function decodeHtml(html) {
    var txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}

function onCopyToClipboardClick()
{
    var output = document.getElementById("output_textarea");
    copyToClipboard(decodeHtml(output.innerHTML));
}

function contains(libraries, name)
{
    for(const lib of libraries){
        if(lib.name == name)
            return true;
    }
    return false;
}

function generate_script()
{
    var script = "";

    var projectName = document.getElementById("project_name_text_field").value;
    var projectFolder = document.getElementById("folder_name_text_field").value;
    var enabledLibs = getEnabledLibraries();

    script += "#!/bin/bash\n";
    script += "project_name=" + projectName + "\n";
    script += "project_folder_name=" + projectFolder+ "\n";
    script += "source_folder_name=src\n";
    script += "is_library=false\n";
    script += "\n";
    script += "submodule_urls=(\n"
    for(const lib of enabledLibs)
    {
        script += lib.url + " \n";
    }
    script += ")\n";
    script += "submodule_names=(\n";
    for(const lib of enabledLibs)
    {
        script += lib.name + " \n";
    }
    script += ")\n";
    script += "\n";
    script += "# takes a path to where main should lie\n";
    script += "function make_main\n";
    script += "{\n";
    script += "    echo \"#include <iostream>\" > $1\n";
    script += "    echo >> $1\n";
    script += "    echo \"int main(int /* argc */, char * /* argv */ [])\" >> $1\n";
    script += "    echo \"{\" >> $1\n";
    script += "    echo \"    std::cout << \\\"Hello World\\\" << std::endl;\" >> $1\n";
    script += "    echo \"}\" >> $1\n";
    script += "}\n";
    script += "\n";
    script += "function make_cmakelists \n";
    script += "{\n";
    script += "    # header\n";
    script += "    echo cmake_minimum_required\\(VERSION 3.8\\) > $1\n";
    script += "    echo project\\($project_name\\) >> $1\n";
    script += "    echo >> $1\n";
    script += "    echo \"# ===============================================\" >> $1\n";
    script += "    echo \\\# Global settings >> $1\n";
    script += "    echo >> $1\n";
    script += "    echo set\\(CMAKE_CXX_STANDARD 17\\) >> $1\n";
    script += "    echo set\\(CMAKE_CXX_STANDARD_REQUIRED ON\\) >> $1\n";
    script += "    echo set_property\\(GLOBAL PROPERTY USE_FOLDERS ON\\) >> $1\n";
    script += "    echo >> $1\n";
    script += "    echo \"# ===============================================\" >> $1\n";
    script += "    echo \\\# Bin dir >> $1\n";

    script += "    echo if\\(MSVC\\) >> $1\n";
    script += "    echo \"    \" set\\(BIN_DIR \\\${CMAKE_SOURCE_DIR}/bin\\) >> $1\n";
    script += "    echo elseif\\(CMAKE_BUILD_TYPE STREQUAL \\\"\\\"\\) >> $1\n";
    script += "    echo \"    \" set\\(BIN_DIR \\\${CMAKE_SOURCE_DIR}/bin/Default\\) >> $1\n";
    script += "    echo else\\(\\) >> $1\n";
    script += "    echo \"    \" set\\(BIN_DIR \\\${CMAKE_SOURCE_DIR}/bin/${CMAKE_BUILD_TYPE}\\) >> $1\n";
    script += "    echo endif\\(\\) >> $1\n";
    script += "    echo >> $1\n";

    script += "    echo set\\(CMAKE_RUNTIME_OUTPUT_DIRECTORY \\\${BIN_DIR}\\) >> $1\n";
    script += "    echo set\\(CMAKE_RUNTIME_OUTPUT_DIRECTORY_RELEASE \\\${BIN_DIR}\\) >> $1\n";
    script += "    echo set\\(CMAKE_RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO \\\${BIN_DIR}\\) >> $1\n";
    script += "    echo set\\(CMAKE_RUNTIME_OUTPUT_DIRECTORY_DEBUG \\\${BIN_DIR}\\) >> $1\n";
    if(contains(enabledLibs, "glow"))
    {
        script += "    echo set\\(GLOW_BIN_DIR \\\${CMAKE_SOURCE_DIR}/bin\\) >> $1\n";
        script += "    echo >> $1\n";
    }

    script += "\n";
    script += "    echo \"# ===============================================\" >> $1\n";
    script += "    echo \\\# add submodules >> $1\n";
    script += "    for name in ${submodule_names[*]}; do\n";
    script += "        echo add_subdirectory\\(extern/$name\\) >> $1\n";
    script += "    done\n";
    script += "\n";
    script += "    echo >> $1\n";
    script += "    echo \"# ===============================================\" >> $1\n";
    script += "    echo \\\# Configure executable >> $1\n";
    script += "\n";
    script += "    # do evil glob\n";
    script += "    echo file\\(GLOB_RECURSE SOURCES >> $1\n";
    script += "    echo \"    \" \"src/*.cc\" >> $1\n";
    script += "    echo \"    \" \"src/*.hh\" >> $1\n";
    script += "    echo \"    \" \"src/*.cpp\" >> $1\n";
    script += "    echo \"    \" \"src/*.h\" >> $1\n";
    script += "    echo \\) >> $1\n";
    script += "    echo >> $1\n";
    script += "    \n";
    script += "    echo \\\# group sources according to folder structure >> $1\n";
    script += "    echo source_group\\(TREE \\${CMAKE_CURRENT_SOURCE_DIR} FILES \\${SOURCES}\\) >> $1\n";
    script += "    echo >> $1\n";
    script += "    \n";
    script += "    echo \"# ===============================================\" >> $1\n";
    script += "    echo \\\# Make executable >> $1\n";
    script += "    echo add_executable\\(\\${PROJECT_NAME} \\${SOURCES}\\) >> $1\n";
    script += "    echo >> $1\n";
    script += "\n";

    if(contains(enabledLibs,"glfw"))
    {
        script += "    echo \"# ===============================================\" >> $1\n";
        script += "    echo \\\# Mute some GLWF warnigns >> $1\n";
        script += "    echo option\\(GLFW_BUILD_EXAMPLES \\\"\\\" OFF\\) >> $1\n";
        script += "    echo option\\(GLFW_BUILD_TESTS \\\"\\\" OFF\\) >> $1\n";
        script += "    echo option\\(GLFW_BUILD_DOCS \\\"\\\" OFF\\) >> $1\n";
        script += "    echo option\\(GLFW_INSTALL \\\"\\\" OFF\\) >> $1\n";
        script += "    echo >> $1\n";
        script += "\n";
    }
    
    script += "    echo \"# ===============================================\" >> $1\n";
    script += "    echo >> $1 \\\# Set link libraries\n";
    script += "    echo target_link_libraries\\(\\${PROJECT_NAME} PUBLIC >> $1\n";
    script += "    for name in ${submodule_names[*]}; do\n";
    script += "        echo \"    \" $name >> $1\n";
    script += "    done\n";
    script += "    echo \\) >> $1\n";
    script += "    echo >> $1\n";
    script += "    echo target_include_directories\\(\\${PROJECT_NAME} PUBLIC \"src\"\\) >> $1\n";
    script += "    echo >> $1\n";
    script += "\n";
    script += "    echo \"# ===============================================\" >> $1\n";
    script += "    echo \\\# Compile flags >> $1\n";
    script += "    echo if \\(MSVC\\) >> $1\n";
    script += "    echo \"    \" target_compile_options\\(\\${PROJECT_NAME} PUBLIC >> $1\n";
    script += "    echo \"        \" /MP >> $1\n";
    script += "    echo \"    \" \\) >> $1\n";
    script += "    echo else\\(\\) >> $1\n";
    script += "    echo \"    \" target_compile_options\\(\\${PROJECT_NAME} PUBLIC >> $1\n";
    script += "    echo \"        \" -Wall >> $1\n";
    script += "    echo \"        \" -Werror >> $1\n";
    script += "    echo \"        \" -march=native >> $1\n";
    script += "    echo \"    \" \\) >> $1\n";
    script += "    echo endif\\(\\) >> $1\n";
    script += "\n";
    script += "    # todo: add test folder and executable\n";
    script += "\n";
    script += "}\n";
    script += "\n";
    script += "mkdir \"$project_folder_name\"\n";
    script += "cd \"$project_folder_name\"\n";
    script += "\n";
    script += "make_cmakelists \"CMakeLists.txt\"\n";
    script += "touch \"readme.md\"\n";
    script += "mkdir \"extern\"\n";
    script += "mkdir \"src\"\n";
    script += "mkdir \"bin\"\n";
    script += "\n";
    script += "if $is_library; then\n";
    script += "    mkdir \"src/$project_folder_name\"\n";
    script += "    mkdir \"test\"\n";
    script += "    make_main \"test/main.cc\"\n";
    script += "else\n";
    script += "    make_main \"src/main.cc\"\n";
    script += "fi\n";
    script += "\n";
    script += "git init\n";
    script += "\n";
    script += "cd \"extern\"\n";
    script += "for url in ${submodule_urls[*]}; do\n";
    script += "    git submodule add $url\n";
    script += "done\n";
    script += "cd ..\n";
    script += "\n";
    script += "git submodule update --init --recursive\n";
    script += "\n";
    script += "# move back up\n";
    script += "cd ..\n";
    return script;
}

window.onload = function()
{
    this.setupCheckboxes();
}
