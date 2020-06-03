import argparse
import urllib.request
import json
import os.path
from subprocess import call
from pathlib import Path


class Library(object):
    def __init__(self, data):
        self.__dict__ = data


def load_libraries(origin_url : str):
    with urllib.request.urlopen(origin_url + "libraries.json") as url:
        data = json.loads(url.read().decode())
        libraries = []
        for lib in data["libraries"]:
            libraries.append(Library(lib))
        return libraries


def create_main(filepath):
    with open(filepath, "w") as f:
        f.write('#include <cstdio>\n\n')
        f.write('int main()\n')
        f.write('{\n')
        f.write('    printf("application main\\n");\n')
        f.write('    return 0;\n')
        f.write('}\n')


def create_cmakelists(filepath, project_name : str, flags_linux : str, flags_msvc : str, enabled_libraries):
    with open(filepath, "w") as f:
        
        project_caps_prefix = project_name[0:3].upper()

        # HEADER
        f.write('cmake_minimum_required(VERSION 3.8)\n')
        f.write('project(' + project_name + ')\n\n')
        f.write("""
include(cmake/UnityBuild.cmake)
include(cmake/SourceGroup.cmake)

# ===============================================
# global settings

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set_property(GLOBAL PROPERTY USE_FOLDERS ON)

# ===============================================
# options

option({0}_ENABLE_ASAN "Enables clang/MSVC address sanitizer" OFF)
option({0}_ENABLE_MSAN "Enables clang/MSVC memory sanitizer" OFF)
option({0}_ENABLE_UBSAN "Enables clang/MSVC undefined behaviour sanitizer" OFF)
option({0}_ENABLE_TSAN "Enables clang/MSVC thread sanitizer" OFF)

if ({0}_ENABLE_ASAN AND {0}_ENABLE_TSAN)
    message(FATAL_ERROR "Can only enable one of TSan or ASan at a time")
endif()
if ({0}_ENABLE_ASAN AND {0}_ENABLE_MSAN)
    message(FATAL_ERROR "Can only enable one of ASan or MSan at a time")
endif()

option({0}_ENABLE_WERROR "Enables -Werror, /WX" OFF)
option({0}_ENABLE_UNITY_BUILD "If enabled, compiles this executable as a single compilation unit" OFF)

# ===============================================
# compiler and linker flags

set(COMMON_COMPILER_FLAGS "")
set(COMMON_LINKER_FLAGS "")

if (MSVC)
    list(APPEND COMMON_COMPILER_FLAGS {2})

    if ({0}_ENABLE_WERROR)
        list(APPEND COMMON_COMPILER_FLAGS /WX)
    endif()
else()
    list(APPEND COMMON_COMPILER_FLAGS {1})

    if ({0}_ENABLE_WERROR)
        list(APPEND COMMON_COMPILER_FLAGS -Werror)
    endif()

    if ({0}_ENABLE_ASAN OR {0}_ENABLE_TSAN OR {0}_ENABLE_MSAN OR {0}_ENABLE_UBSAN)
        list(APPEND COMMON_COMPILER_FLAGS -fno-omit-frame-pointer -g)
        list(APPEND COMMON_LINKER_FLAGS -fno-omit-frame-pointer -g)
    endif()

    if ({0}_ENABLE_ASAN)
        list(APPEND COMMON_COMPILER_FLAGS -fsanitize=address)
        list(APPEND COMMON_LINKER_FLAGS -fsanitize=address)
    endif()

    if ({0}_ENABLE_TSAN)
        list(APPEND COMMON_COMPILER_FLAGS -fsanitize=thread)
        list(APPEND COMMON_LINKER_FLAGS -fsanitize=thread)
    endif()

    if ({0}_ENABLE_MSAN)
        list(APPEND COMMON_COMPILER_FLAGS -fsanitize=memory)
        list(APPEND COMMON_LINKER_FLAGS -fsanitize=memory)
    endif()

    if ({0}_ENABLE_UBSAN)
        list(APPEND COMMON_COMPILER_FLAGS
            -fsanitize=undefined
            -fno-sanitize-recover=all
            -fno-sanitize=alignment,vptr
        )
        list(APPEND COMMON_LINKER_FLAGS
            -fsanitize=undefined
            -fno-sanitize-recover=all
            -fno-sanitize=alignment,vptr
        )
    endif()
endif()

# ===============================================
# Bin dir
if(MSVC)
    set(BIN_DIR ${{CMAKE_SOURCE_DIR}}/bin)
elseif(CMAKE_BUILD_TYPE STREQUAL "")
    set(BIN_DIR ${{CMAKE_SOURCE_DIR}}/bin/Default)
else()
    set(BIN_DIR ${{CMAKE_SOURCE_DIR}}/bin/${{CMAKE_BUILD_TYPE}})
endif()
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY ${{BIN_DIR}})
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_RELEASE ${{BIN_DIR}})
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_RELWITHDEBINFO ${{BIN_DIR}})
set(CMAKE_RUNTIME_OUTPUT_DIRECTORY_DEBUG ${{BIN_DIR}})

        """.format(project_caps_prefix, flags_linux, flags_msvc))

        # GLOW needs a special bin directory
        if any(lib.name == "glow" for lib in enabled_libraries):
            f.write("set(GLOW_BIN_DIR ${CMAKE_SOURCE_DIR}/bin)\n")

        # GLFW is annoying
        if(any(lib.name == "glfw" for lib in enabled_libraries)):
            f.write("\n")
            f.write('# ===============================================\n')
            f.write('# disable glfw additionals\n')
            f.write('option(GLFW_BUILD_EXAMPLES "" OFF)\n')
            f.write('option(GLFW_BUILD_TESTS "" OFF)\n')
            f.write('option(GLFW_BUILD_DOCS "" OFF)\n')
            f.write('option(GLFW_INSTALL "" OFF)\n')

        # Add the submodules
        f.write("\n")
        f.write("# ===============================================\n")
        f.write("# add submodules\n")
        for lib in enabled_libraries:
            f.write("""
# {0}
add_subdirectory(extern/{1})
""".format(lib.description, lib.name))

        f.write("""

# ===============================================
# configure executable

file(GLOB_RECURSE SOURCES "src/*.cc" "src/*.cpp" "src/*.c")
file(GLOB_RECURSE HEADERS "src/*.hh" "src/*.h" "src/*.inl")

arcana_source_group(SOURCES HEADERS)

if ({0}_ENABLE_UNITY_BUILD)
    arcana_enable_unity_build(${{PROJECT_NAME}} SOURCES 150 cc)
endif()

add_executable(${{PROJECT_NAME}} ${{SOURCES}} ${{HEADERS}})

target_include_directories(${{PROJECT_NAME}} PUBLIC "src/")
target_compile_options(${{PROJECT_NAME}} PUBLIC ${{COMMON_COMPILER_FLAGS}})

""".format(project_caps_prefix))

        f.write('target_link_libraries(${PROJECT_NAME} PUBLIC\n')
        for lib in enabled_libraries:
            if hasattr(lib, "no_link_main"):
                continue
            f.write("    " + lib.name + "\n")

        f.write("    ${COMMON_LINKER_FLAGS}\n")
        f.write(')\n')

def download_files(origin_url : str, project_name : str, create_shader_folder : bool):
    raw_data_download_url = origin_url
    if "github" in origin_url:
        # extract github raw domain
        github_username = origin_url.split("/")[2].split(".")[0]
        github_reponame = origin_url.split("/")[3]
        raw_data_download_url = "https://raw.githubusercontent.com/{}/{}/master".format(github_username, github_reponame)

    urllib.request.urlretrieve(raw_data_download_url + "/data/.clang-format", os.path.join(project_name, ".clang-format"))
    urllib.request.urlretrieve(raw_data_download_url + "/data/.gitignore", os.path.join(project_name, ".gitignore"))
    urllib.request.urlretrieve(raw_data_download_url + "/data/UnityBuild.cmake", os.path.join(project_name, "cmake/UnityBuild.cmake"))
    urllib.request.urlretrieve(raw_data_download_url + "/data/SourceGroup.cmake", os.path.join(project_name, "cmake/SourceGroup.cmake"))

    # folder structure for shader writing and compilation
    if create_shader_folder:
        # create folders
        os.mkdir(os.path.join(project_name, "res"))
        os.mkdir(os.path.join(project_name, "res/shader"))
        os.mkdir(os.path.join(project_name, "res/shader/bin"))
        os.mkdir(os.path.join(project_name, "res/shader/src"))
        # download files
        dl_url_shader = raw_data_download_url + "/data/shader_setup/"
        urllib.request.urlretrieve(dl_url_shader + ".gitignore", os.path.join(project_name, "res/shader/.gitignore"))
        urllib.request.urlretrieve(dl_url_shader + "bin/.gitignore", os.path.join(project_name, "res/shader/bin/.gitignore"))
        urllib.request.urlretrieve(dl_url_shader + "src/imgui.hlsl", os.path.join(project_name, "res/shader/src/imgui.hlsl"))
        urllib.request.urlretrieve(dl_url_shader + "shaderlist.txt", os.path.join(project_name, "res/shader/shaderlist.txt"))
        urllib.request.urlretrieve(dl_url_shader + "shadertoolsconfig.json", os.path.join(project_name, "res/shader/shadertoolsconfig.json"))



def get_enabled_libs(args):
    all_libs = load_libraries(args.origin)
    return list(filter(lambda lib: lib.name in args.libraries, all_libs))


def setup_project(args):
    project_name = args.name
    project_url = args.url
    enabled_libs = get_enabled_libs(args)
    origin_url = args.origin

    if(os.path.isdir(project_name)):
        print("Directory " + project_name + " already exists! Aborting!")
        return

    # clone or init the repository
    if(project_url):
        call(["git", "clone", project_url, project_name])
    else:
        print("No git repository given. Initializing git...")
        os.mkdir(project_name)
        call(["git", "-C", project_name, "init"])

    # create folders
    os.mkdir(os.path.join(project_name, "extern"))
    os.mkdir(os.path.join(project_name, "src"))
    os.mkdir(os.path.join(project_name, "bin"))
    os.mkdir(os.path.join(project_name, "cmake"))

    # create readme, main, cmakelists
    Path(os.path.join(project_name, "README.md")).touch()
    create_main(os.path.join(project_name, 'src', 'main.cc'))

    create_cmakelists(os.path.join(
        project_name, "CMakeLists.txt"), project_name, args.flags_linux, args.flags_msvc, enabled_libs)


    # determine if dxc-wrapper is enabled, if yes, create the shader folder skeleton below
    is_dxc_enabled = False
    for lib in enabled_libs:
        if lib.name == "dxc-wrapper":
            is_dxc_enabled = True
            break

    # download gitignore, clang-format, UnityBuild.cmake
    download_files(origin_url, project_name, is_dxc_enabled)
    
    # add submodules
    for lib in enabled_libs:
        call(["git", "-C", os.path.join(project_name,
                                        "extern"), "submodule", "add", lib.git_url, lib.name])

    call(["git", "-C", project_name, "submodule",
          "update", "--init", "--recursive"])

    print("DONE!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Create project with dependencies")
    parser.add_argument("--name", "-n", type=str, required=True)
    parser.add_argument("--origin", "-o", type=str, required=True)
    parser.add_argument("--flags_linux", "-l", type=str)
    parser.add_argument("--flags_msvc", "-m", type=str)
    parser.add_argument("--url", "-u", type=str)
    parser.add_argument("libraries", nargs='*', type=str)
    args = parser.parse_args()

    setup_project(args)
